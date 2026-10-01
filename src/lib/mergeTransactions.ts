import type { Transaction } from "@/hooks/useTransactions";
import type { SyncedTransaction } from "@/hooks/useBankConnections";

/** Transação vista pelas telas: lançada à mão ou vinda do banco (Pluggy/arquivo). */
export interface UnifiedTransaction {
  id: string;
  origin: "manual" | "bank";
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  date: string;
  installment_info: string | null;
  category_source: string | null;
  /** Presente em lançamentos manuais (para editar/excluir) */
  manual?: Transaction;
  /** Presente em lançamentos do banco (para trocar categoria) */
  synced?: SyncedTransaction;
}

/**
 * Junta os lançamentos manuais (tabela transactions) com os do banco (synced_transactions).
 * Os sincronizados já importados para transactions (is_reviewed) ficam de fora para não contar duas vezes.
 */
export function mergeTransactions(manual: Transaction[], synced: SyncedTransaction[]): UnifiedTransaction[] {
  const fromManual: UnifiedTransaction[] = manual.map((t) => ({
    id: t.id,
    origin: "manual",
    type: t.type,
    description: t.description,
    category: t.category,
    amount: Number(t.amount),
    date: t.date,
    installment_info: null,
    category_source: null,
    manual: t,
  }));

  const fromBank: UnifiedTransaction[] = synced
    .filter((t) => !t.is_reviewed)
    .map((t) => ({
      id: t.id,
      origin: "bank",
      type: t.type === "income" ? "income" : "expense",
      description: t.description,
      category: t.ai_category || t.original_category || "Outros",
      amount: Number(t.amount),
      date: t.date,
      installment_info: t.installment_info,
      category_source: t.category_source,
      synced: t,
    }));

  return [...fromManual, ...fromBank].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
