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

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Pluggy auth failed [${resp.status}]: ${t}`);
  }

  const { apiKey } = await resp.json();
  return apiKey;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate user
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "create-connect-token") {
      const apiKey = await getPluggyApiKey();
      // Create a connect token for the Pluggy Connect widget
      const resp = await fetch(`${PLUGGY_API_URL}/connect_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Failed to create connect token [${resp.status}]: ${t}`);
      }

      const data = await resp.json();
      return new Response(JSON.stringify({ accessToken: data.accessToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save-connection") {
      const { itemId, institutionName } = await req.json();
      if (!itemId || !institutionName) {
        return new Response(JSON.stringify({ error: "itemId and institutionName required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userId = claimsData.claims.sub;

      const { data, error } = await supabase
        .from("bank_connections")
        .insert({
          user_id: userId,
          pluggy_item_id: itemId,
          institution_name: institutionName,
          status: "connected",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-connections") {
      const userId = claimsData.claims.sub;
      const { data, error } = await supabase
        .from("bank_connections")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-connection") {
      const { connectionId } = await req.json();
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await supabase
        .from("bank_connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("pluggy-connect error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
