import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, getUserClient, jsonResponse } from "../_shared/http.ts";
import { parseCategorizeInput } from "../_shared/validation.ts";
import { categorizeWithAI } from "../_shared/ai-categorize.ts";

/** Ids por consulta (vão na URL). */
const ID_CHUNK = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    // Lista limitada e validada: evita custo alto de IA com entradas enormes
    const requested = parseCategorizeInput(await req.json().catch(() => ({})));
    if (!requested.length) return jsonResponse({ categorized: 0 });

    // Só o que existe no banco, é da pessoa (RLS) e ainda não tem categoria. A descrição vem do banco,
    // nunca do pedido: ninguém gasta IA com texto inventado nem injeta instruções no prompt.
    const ids = [...new Set(requested.map((t) => t.id))];
    const transactions: Array<{ id: string; description: string }> = [];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await auth.supabase
        .from("synced_transactions")
        .select("id, description")
        .in("id", ids.slice(i, i + ID_CHUNK))
        .is("category_source", null);
      if (error) throw error;
      transactions.push(...(data ?? []));
    }
    if (!transactions.length) return jsonResponse({ categorized: 0 });

    const categorized = await categorizeWithAI(auth.supabase, transactions);
    return jsonResponse({ categorized });
  } catch (e) {
    return errorResponse("categorize-transactions error", e);
  }
});
