import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { CATEGORIES } from "./categorization.ts";

/**
 * Categoriza transações com IA e grava em synced_transactions.
 * Sem LOVABLE_API_KEY a função não faz nada (as regras de palavra-chave continuam valendo).
 */
export async function categorizeWithAI(
  supabase: SupabaseClient,
  transactions: Array<{ id: string; description: string }>,
): Promise<number> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY not configured; skipping AI categorization");
    return 0;
  }
  if (!transactions.length) return 0;

  // Batch transactions for AI categorization (max 20 at a time)
  const batchSize = 20;
  let categorized = 0;

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const descriptions = batch.map((t, idx) => `${idx + 1}. "${t.description}"`).join("\n");

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
      console.error("AI error status:", aiResp.status);
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
                category_source: "ai",
              })
              .eq("id", tx.id)
              // Não sobrescreve categoria escolhida pelo usuário ou por regra
              .is("category_source", null);
            categorized++;
          }
        }
      } catch (parseErr) {
        console.error("Failed to parse AI response:", parseErr);
      }
    }
  }

  return categorized;
}
