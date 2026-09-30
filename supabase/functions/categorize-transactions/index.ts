import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorMessage, getUserClient, jsonResponse } from "../_shared/http.ts";
import { categorizeWithAI } from "../_shared/ai-categorize.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const { transactions } = await req.json();
    if (!transactions?.length) return jsonResponse({ categorized: 0 });

    // O cliente do usuário aplica RLS: só atualiza transações dele
    const categorized = await categorizeWithAI(auth.supabase, transactions);
    return jsonResponse({ categorized });
  } catch (e) {
    console.error("categorize-transactions error:", errorMessage(e));
    return jsonResponse({ error: errorMessage(e) }, 500);
  }
});
