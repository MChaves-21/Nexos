import type { Transaction } from "@/hooks/useTransactions";
import type { SyncedTransaction } from "@/hooks/useBankConnections";
import { resolveCategory } from "@shared/categorization";
import { findManualDuplicates, findOwnTransfers, isCardRefund, type LedgerRow } from "@shared/ledger";

/** Transação vista pelas telas: lançada à mão ou vinda do banco (Pluggy/arquivo). */
export interface UnifiedTransaction {
  id: string;
  origin: "manual" | "bank";
  type: "income" | "expense";
  description: string;
  category: string;
  /**
   * Valor somado nos totais. Sempre positivo, exceto em estornos do cartão:
   * eles ficam como saída negativa, para abater o gasto da categoria em vez de virar renda.
   */
  amount: number;
  date: string;
  installment_info: string | null;
  category_source: string | null;
  /** Estorno/cashback no cartão (amount negativo) */
  refund?: boolean;
  /** Presente em lançamentos manuais (para editar/excluir) */
  manual?: Transaction;
  /** Presente em lançamentos do banco (para trocar categoria) */
  synced?: SyncedTransaction;
}

export interface MergeOptions {
  /** Contas de cartão de crédito (bank_accounts.id com type = CREDIT) */
  cardAccountIds?: ReadonlySet<string>;
}

export interface Ledger {
  transactions: UnifiedTransaction[];
  /** Lançamentos manuais que repetem uma transação do banco: ficam fora dos totais */
  manualDuplicates: Array<{ manual: UnifiedTransaction; bank: UnifiedTransaction }>;
}

const accountKeyOf = (t: SyncedTransaction) => t.bank_account_id ?? `${t.bank_connection_id}:${t.source}`;
const isCard = (t: SyncedTransaction, cards?: ReadonlySet<string>) =>
  t.source === "csv_card" || (!!t.bank_account_id && !!cards?.has(t.bank_account_id));

/**
 * Junta os lançamentos manuais (tabela transactions) com os do banco (synced_transactions):
 * - os sincronizados já importados para transactions (is_reviewed) ficam de fora;
 * - pares saída/entrada entre contas próprias viram Transferência;
 * - estornos no cartão abatem o gasto;
 * - lançamentos manuais repetidos pelo banco saem dos totais (ver `manualDuplicates`).
 */
export function buildLedger(manual: Transaction[], synced: SyncedTransaction[], opts: MergeOptions = {}): Ledger {
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

  const pending = synced.filter((t) => !t.is_reviewed);
  const bankRows: LedgerRow[] = pending.map((t) => ({
    id: t.id,
    type: t.type === "income" ? "income" : "expense",
    amount: Number(t.amount),
    date: t.date,
    description: t.description,
    category: resolveCategory(t.ai_category, t.original_category),
    accountKey: accountKeyOf(t),
    locked: t.category_source === "user",
  }));
  const transfers = findOwnTransfers(bankRows);

  const fromBank: UnifiedTransaction[] = pending.map((t, idx) => {
    const row = bankRows[idx];
    const category = transfers.has(t.id) ? "Transferência" : row.category;
    const refund = isCardRefund({ type: row.type, category }, isCard(t, opts.cardAccountIds));
    return {
      id: t.id,
      origin: "bank",
      type: refund ? "expense" : row.type,
      description: t.description,
      category,
      amount: refund ? -row.amount : row.amount,
      date: t.date,
      installment_info: t.installment_info,
      category_source: transfers.has(t.id) && t.category_source !== "user" ? "rule" : t.category_source,
      refund: refund || undefined,
      synced: t,
    };
  });

  const asLedger = (t: UnifiedTransaction): LedgerRow => ({
    id: t.id, type: t.type, amount: Math.abs(t.amount), date: t.date, description: t.description, category: t.category, accountKey: null,
  });
  const duplicates = findManualDuplicates(fromManual.map(asLedger), fromBank.filter((t) => !t.refund).map(asLedger));
  const bankById = new Map(fromBank.map((t) => [t.id, t]));

  const byDateDesc = (a: UnifiedTransaction, b: UnifiedTransaction) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  return {
    transactions: [...fromManual.filter((t) => !duplicates.has(t.id)), ...fromBank].sort(byDateDesc),
    manualDuplicates: fromManual
      .filter((t) => duplicates.has(t.id))
      .map((t) => ({ manual: t, bank: bankById.get(duplicates.get(t.id)!)! })),
  };
}

/** Só a lista unificada (ver buildLedger). */
export function mergeTransactions(manual: Transaction[], synced: SyncedTransaction[], opts: MergeOptions = {}): UnifiedTransaction[] {
  return buildLedger(manual, synced, opts).transactions;
}
