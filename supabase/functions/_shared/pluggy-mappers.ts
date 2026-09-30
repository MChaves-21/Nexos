// Conversão dos objetos da API Pluggy para as linhas do banco.
// Módulo puro (sem imports) para poder ser testado com Vitest.

export interface PluggyItem {
  id: string;
  status: string; // UPDATED | UPDATING | WAITING_USER_INPUT | LOGIN_ERROR | OUTDATED
  executionStatus?: string;
  error?: { code?: string; message?: string } | null;
  consentExpiresAt?: string | null;
  connector?: { name?: string } | null;
}

export interface PluggyAccount {
  id: string;
  type: string; // BANK | CREDIT
  subtype?: string | null;
  name: string;
  marketingName?: string | null;
  number?: string | null;
  balance?: number | null;
  currencyCode?: string | null;
  creditData?: { creditLimit?: number | null; availableCreditLimit?: number | null } | null;
}

export interface PluggyTransaction {
  id: string;
  description?: string | null;
  descriptionRaw?: string | null;
  amount: number;
  date: string;
  type?: "DEBIT" | "CREDIT" | null;
  status?: "PENDING" | "POSTED" | null;
  category?: string | null;
  creditCardMetadata?: { installmentNumber?: number | null; totalInstallments?: number | null } | null;
}

export interface PluggyInvestment {
  id: string;
  name: string;
  code?: string | null;
  type: string;
  subtype?: string | null;
  balance?: number | null;
  amountOriginal?: number | null;
  amountProfit?: number | null;
  quantity?: number | null;
  value?: number | null;
  rate?: number | null;
  rateType?: string | null;
  issuer?: string | null;
  status?: string | null;
  dueDate?: string | null;
  date?: string | null;
  currencyCode?: string | null;
}

export type ConnectionStatus = "connected" | "syncing" | "outdated" | "reauth_required" | "error";

export function mapItemStatus(item: PluggyItem, now: Date = new Date()): {
  status: ConnectionStatus;
  detail: string | null;
  consentExpiresAt: string | null;
} {
  const consentExpiresAt = item.consentExpiresAt ?? null;
  const consentExpired = consentExpiresAt !== null && new Date(consentExpiresAt) <= now;
  const errorMessage = item.error?.message ?? null;

  if (consentExpired) {
    return { status: "reauth_required", detail: "Consentimento do Open Finance expirado. Reconecte o banco.", consentExpiresAt };
  }
  switch (item.status) {
    case "UPDATED":
      return { status: "connected", detail: null, consentExpiresAt };
    case "UPDATING":
      return { status: "syncing", detail: "O banco ainda está atualizando os dados na Pluggy.", consentExpiresAt };
    case "LOGIN_ERROR":
    case "WAITING_USER_INPUT":
      return { status: "reauth_required", detail: errorMessage ?? "É preciso autorizar a conexão de novo.", consentExpiresAt };
    case "OUTDATED":
      return { status: "outdated", detail: errorMessage ?? "A última atualização no banco falhou; os dados podem estar desatualizados.", consentExpiresAt };
    default:
      return { status: "error", detail: errorMessage ?? `Status desconhecido: ${item.status}`, consentExpiresAt };
  }
}

export function mapAccount(account: PluggyAccount) {
  return {
    external_id: account.id,
    name: account.marketingName || account.name,
    type: account.type,
    subtype: account.subtype ?? null,
    number: account.number ?? null,
    balance: account.balance ?? 0,
    currency_code: account.currencyCode ?? "BRL",
    credit_limit: account.creditData?.creditLimit ?? null,
    available_credit_limit: account.creditData?.availableCreditLimit ?? null,
  };
}

/**
 * Decide se a transação é saída ou entrada.
 * O campo `type` (DEBIT/CREDIT) é a fonte confiável; o sinal de `amount` muda de
 * significado entre conta corrente e cartão de crédito, então só é usado como fallback.
 */
export function transactionKind(tx: PluggyTransaction, accountType: string): "expense" | "income" {
  if (tx.type === "DEBIT") return "expense";
  if (tx.type === "CREDIT") return "income";
  if (accountType === "CREDIT") return tx.amount > 0 ? "expense" : "income";
  return tx.amount < 0 ? "expense" : "income";
}

export function installmentInfo(tx: PluggyTransaction): string | null {
  const n = tx.creditCardMetadata?.installmentNumber;
  const total = tx.creditCardMetadata?.totalInstallments;
  if (n && total && total > 1) return `${n}/${total}`;
  return null;
}

/** Transações pendentes são ignoradas: a Pluggy troca o id quando elas são lançadas. */
export function shouldImportTransaction(tx: PluggyTransaction): boolean {
  return tx.status !== "PENDING";
}

export function mapTransaction(tx: PluggyTransaction, accountType: string) {
  return {
    external_id: tx.id,
    description: (tx.description || tx.descriptionRaw || "Sem descrição").trim(),
    amount: Math.abs(tx.amount),
    date: tx.date.slice(0, 10),
    type: transactionKind(tx, accountType),
    original_category: tx.category ?? null,
    installment_info: installmentInfo(tx),
    source: "pluggy" as const,
  };
}

export function mapInvestment(inv: PluggyInvestment) {
  return {
    external_id: inv.id,
    name: inv.name,
    code: inv.code ?? null,
    type: inv.type,
    subtype: inv.subtype ?? null,
    balance: inv.balance ?? 0,
    amount_original: inv.amountOriginal ?? null,
    amount_profit: inv.amountProfit ?? null,
    quantity: inv.quantity ?? null,
    unit_value: inv.value ?? null,
    rate: inv.rate ?? null,
    rate_type: inv.rateType ?? null,
    issuer: inv.issuer ?? null,
    status: inv.status ?? null,
    due_date: inv.dueDate ? inv.dueDate.slice(0, 10) : null,
    reference_date: inv.date ? inv.date.slice(0, 10) : null,
    currency_code: inv.currencyCode ?? "BRL",
  };
}

/** Janela de busca: 1 ano na primeira sincronização, depois desde a última menos 10 dias (lançamentos retroativos). */
export function syncFromDate(lastSyncAt: string | null, now: Date = new Date()): string {
  const d = lastSyncAt ? new Date(lastSyncAt) : new Date(now);
  if (lastSyncAt) d.setUTCDate(d.getUTCDate() - 10);
  else d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
