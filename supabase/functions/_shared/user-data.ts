// Tabelas com dados de cada usuário (LGPD: exportação e exclusão).
// Ordem de exclusão: filhas antes das mães (respeita as chaves estrangeiras).
export const USER_TABLES_DELETE_ORDER = [
  "notifications",
  "bill_payments",
  "bills",
  "synced_transactions",
  "synced_investments",
  "bank_accounts",
  "bank_connections",
  "categorization_rules",
  "transactions",
  "investments",
  "category_budgets",
  "financial_goals",
  "allocation_targets",
  "saved_simulations",
  "asset_alert_thresholds",
  "price_alert_settings",
  "pluggy_credentials",
] as const;

export const CONFIRMATION_WORD = "EXCLUIR";

export function isDeletionConfirmed(body: unknown): boolean {
  const confirm = (body as { confirm?: unknown } | null)?.confirm;
  return typeof confirm === "string" && confirm.trim().toUpperCase() === CONFIRMATION_WORD;
}
