import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLUGGY_API_URL = "https://api.pluggy.ai";

async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Pluggy credentials not configured");

  const resp = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!resp.ok) throw new Error(`Pluggy auth failed [${resp.status}]`);
  const { apiKey } = await resp.json();
  return apiKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub as string;
    const { connectionId } = await req.json();

    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get bank connection
    const { data: connection, error: connError } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = await getPluggyApiKey();

    // Fetch transactions from Pluggy
    const txResp = await fetch(`${PLUGGY_API_URL}/transactions?itemId=${connection.pluggy_item_id}&pageSize=500`, {
      headers: { "X-API-KEY": apiKey },
    });

    if (!txResp.ok) {
      const t = await txResp.text();
      throw new Error(`Failed to fetch transactions [${txResp.status}]: ${t}`);
    }

    const { results: pluggyTransactions } = await txResp.json();

    // Map and upsert transactions
    let synced = 0;
    const transactionsToCategorie: Array<{ id: string; description: string }> = [];

    for (const tx of pluggyTransactions || []) {
      const txType = tx.amount < 0 ? "expense" : "income";
      const amount = Math.abs(tx.amount);

      const { data: existing } = await supabase
        .from("synced_transactions")
        .select("id")
        .eq("bank_connection_id", connectionId)
        .eq("external_id", tx.id)
        .maybeSingle();

      if (!existing) {
        const { data: inserted, error: insertError } = await supabase
          .from("synced_transactions")
          .insert({
            user_id: userId,
            bank_connection_id: connectionId,
            external_id: tx.id,
            description: tx.description || tx.descriptionRaw || "Sem descrição",
            amount,
            date: tx.date?.split("T")[0] || new Date().toISOString().split("T")[0],
            type: txType,
            original_category: tx.category || null,
          })
          .select("id, description")
          .single();

        if (!insertError && inserted) {
          synced++;
          transactionsToCategorie.push({ id: inserted.id, description: inserted.description });
        }
      }
    }

    // Update last_sync_at
    await supabase
      .from("bank_connections")
      .update({ last_sync_at: new Date().toISOString(), status: "connected" })
      .eq("id", connectionId);

    // Trigger AI categorization for new transactions
    if (transactionsToCategorie.length > 0) {
      try {
        const categResp = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/categorize-transactions`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
              apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({ transactions: transactionsToCategorie }),
          }
        );
        if (!categResp.ok) {
          console.error("Categorization failed:", await categResp.text());
        }
      } catch (e) {
        console.error("Categorization error:", e);
      }
    }

    return new Response(JSON.stringify({ synced, total: pluggyTransactions?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pluggy-sync error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
