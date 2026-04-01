import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CATEGORIES = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
  "Lazer", "Vestuário", "Serviços", "Assinaturas", "Compras",
  "Transferência", "Investimento", "Salário", "Freelance", "Outros"
];

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { transactions } = await req.json();
    if (!transactions?.length) {
      return new Response(JSON.stringify({ categorized: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch transactions for AI categorization (max 20 at a time)
    const batchSize = 20;
    let categorized = 0;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const descriptions = batch.map((t: { id: string; description: string }, idx: number) => 
        `${idx + 1}. "${t.description}"`
      ).join("\n");

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          tools: [
            {
              type: "function",
              function: {
                name: "categorize_transactions",
                description: "Categorize financial transactions based on their descriptions",
                parameters: {
                  type: "object",
                  properties: {
                    categories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "number", description: "1-based index of the transaction" },
                          category: { type: "string", enum: CATEGORIES },
                          confidence: { type: "number", description: "Confidence level from 0 to 1" },
                        },
                        required: ["index", "category", "confidence"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["categories"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "categorize_transactions" } },
          messages: [
            {
              role: "system",
              content: `Você é um especialista em finanças pessoais brasileiras. Categorize cada transação bancária em uma das seguintes categorias: ${CATEGORIES.join(", ")}. Analise a descrição e determine a categoria mais provável com um nível de confiança de 0 a 1.`,
            },
            {
              role: "user",
              content: `Categorize as seguintes transações:\n${descriptions}`,
            },
          ],
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          console.error("AI rate limited, skipping batch");
          continue;
        }
        if (aiResp.status === 402) {
          console.error("AI credits exhausted");
          break;
        }
        console.error("AI error:", await aiResp.text());
        continue;
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        try {
          const { categories } = JSON.parse(toolCall.function.arguments);

          for (const cat of categories || []) {
            const tx = batch[cat.index - 1];
            if (tx) {
              await supabase
                .from("synced_transactions")
                .update({
                  ai_category: cat.category,
                  ai_confidence: cat.confidence,
                })
                .eq("id", tx.id);
              categorized++;
            }
          }
        } catch (parseErr) {
          console.error("Failed to parse AI response:", parseErr);
        }
      }
    }

    return new Response(JSON.stringify({ categorized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("categorize-transactions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
