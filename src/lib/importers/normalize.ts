import { categorizeByRules, normalizeText, type CategorizationRule } from "@shared/categorization";
import type { ImportSource, NormalizedTransaction } from "./types";

export interface SyncedTransactionInsert {
  external_id: string;
  hash: string;
  source: ImportSource;
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  original_category: string | null;
  installment_info: string | null;
  ai_category: string | null;
  ai_confidence: number | null;
  category_source: "rule" | null;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Converte transações normalizadas nas linhas de synced_transactions.
 * Deduplicação: usa o id da fonte quando existe; senão, hash de conta + data + valor + descrição.
 * Lançamentos idênticos no mesmo arquivo (duas compras iguais no mesmo dia) recebem um
 * contador de ocorrência no hash, então não se anulam e reimportar o arquivo gera os mesmos hashes.
 */
export async function toSyncedRows(
  transactions: NormalizedTransaction[],
  opts: { source: ImportSource; accountKey: string; userRules?: CategorizationRule[] },
): Promise<SyncedTransactionInsert[]> {
  const occurrences = new Map<string, number>();
  const rows: SyncedTransactionInsert[] = [];

  for (const tx of transactions) {
    const description = tx.description.trim() || "Sem descrição";
    const base = [normalizeText(opts.accountKey), tx.date, tx.amount.toFixed(2), normalizeText(description)].join("|");
    const n = occurrences.get(base) ?? 0;
    occurrences.set(base, n + 1);
    const hash = await sha256(`${base}|${n}`);

    const match = categorizeByRules(description, opts.userRules ?? []);
    rows.push({
      external_id: tx.externalId ? `id:${tx.externalId}` : `hash:${hash}`,
      hash,
      source: opts.source,
      date: tx.date,
      amount: Math.abs(tx.amount),
      type: tx.amount < 0 ? "expense" : "income",
      description,
      original_category: tx.originalCategory ?? null,
      installment_info: tx.installmentInfo ?? null,
      ai_category: match?.category ?? null,
      ai_confidence: match ? 1 : null,
      category_source: match ? "rule" : null,
    });
  }
  return rows;
}
