// LGPD: exportação de todos os dados da pessoa num arquivo JSON.

/** Tabelas exportadas. A credencial da Pluggy fica de fora: o app não tem acesso a ela, por segurança. */
export const EXPORT_TABLES = [
  "profiles",
  "transactions",
  "synced_transactions",
  "bank_connections",
  "bank_accounts",
  "synced_investments",
  "investments",
  "category_budgets",
  "financial_goals",
  "categorization_rules",
  "allocation_targets",
  "saved_simulations",
  "price_alert_settings",
  "asset_alert_thresholds",
  "bills",
  "bill_payments",
  "notifications",
  "family_members",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface ExportFile {
  formato: "nexos-export";
  versao: 1;
  gerado_em: string;
  conta: { id: string; email: string | null };
  tabelas: Partial<Record<ExportTable, unknown[]>>;
  /** Tabelas que não puderam ser lidas (ex.: ainda não existem no banco) */
  indisponiveis: string[];
}

export function buildExportFile(
  user: { id: string; email: string | null },
  data: Partial<Record<ExportTable, unknown[]>>,
  unavailable: string[],
  now: Date = new Date(),
): ExportFile {
  return {
    formato: "nexos-export",
    versao: 1,
    gerado_em: now.toISOString(),
    conta: user,
    tabelas: data,
    indisponiveis: unavailable,
  };
}

export function exportFileName(now: Date = new Date()): string {
  return `nexos-meus-dados-${now.toISOString().slice(0, 10)}.json`;
}
