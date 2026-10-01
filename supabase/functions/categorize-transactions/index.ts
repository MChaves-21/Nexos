import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, getUserClient, jsonResponse } from "../_shared/http.ts";
import { parseCategorizeInput } from "../_shared/validation.ts";
import { categorizeWithAI } from "../_shared/ai-categorize.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    // Lista limitada e validada: evita custo alto de IA com entradas enormes
    const transactions = parseCategorizeInput(await req.json().catch(() => ({})));
    if (!transactions.length) return jsonResponse({ categorized: 0 });

    // O cliente do usuário aplica RLS: só atualiza transações dele
    const categorized = await categorizeWithAI(auth.supabase, transactions);
    return jsonResponse({ categorized });
  } catch (e) {
    return errorResponse("categorize-transactions error", e);
  }
});
