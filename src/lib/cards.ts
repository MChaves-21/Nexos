// Cartões: parcelas que ainda vão cair nas próximas faturas.
import { normalizeText } from "@shared/categorization";

export interface InstallmentTx {
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  installment_info: string | null; // "2/5"
  type: string;
  /** Cartão (conta) ou origem, para agrupar */
  cardKey: string;
}

export interface FutureMonth {
  period: string; // YYYY-MM
  total: number;
  items: Array<{ description: string; installment: string; amount: number; cardKey: string }>;
}

const addMonths = (period: string, n: number) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** "Loja X - Parcela 2/5" e "LOJA X 3/5" viram a mesma compra. */
const purchaseKey = (tx: InstallmentTx, total: number) =>
  [tx.cardKey, normalizeText(tx.description).replace(/parcela\s*\d+\s*\/\s*\d+/g, "").replace(/\d+\s*\/\s*\d+/g, "").replace(/[^a-z0-9]+/g, " ").trim(), Number(tx.amount).toFixed(2), total].join("|");

/**
 * Projeta as parcelas restantes de cada compra parcelada nos meses seguintes ao atual.
 * O banco manda uma transação por parcela (2/5, depois 3/5...): usa só a mais recente de cada compra,
 * senão as parcelas futuras seriam contadas mais de uma vez.
 */
export function projectInstallments(txs: InstallmentTx[], currentPeriod: string, months = 6): FutureMonth[] {
  const latest = new Map<string, { tx: InstallmentTx; n: number; total: number }>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !tx.installment_info) continue;
    const m = tx.installment_info.match(/^(\d+)\/(\d+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    const total = Number(m[2]);
    if (n >= total) continue;
    const key = purchaseKey(tx, total);
    const prev = latest.get(key);
    if (!prev || n > prev.n) latest.set(key, { tx, n, total });
  }

  const window = Array.from({ length: months }, (_, i) => addMonths(currentPeriod, i + 1));
  const byPeriod = new Map<string, FutureMonth>(window.map((p) => [p, { period: p, total: 0, items: [] }]));
  for (const { tx, n, total } of latest.values()) {
    const txPeriod = tx.date.slice(0, 7);
    for (let k = 1; k <= total - n; k++) {
      const month = byPeriod.get(addMonths(txPeriod, k));
      if (!month) continue;
      const description = tx.description.replace(/\s*-?\s*parcela\s*\d+\s*\/\s*\d+/i, "").trim();
      month.items.push({ description, installment: `${n + k}/${total}`, amount: Number(tx.amount), cardKey: tx.cardKey });
      month.total += Number(tx.amount);
    }
  }
  return window.map((p) => byPeriod.get(p)!);
}

/** Percentual do limite em uso. */
export function limitUsage(creditLimit: number | null, available: number | null): number | null {
  if (!creditLimit || creditLimit <= 0 || available == null) return null;
  return Math.min(100, Math.max(0, ((creditLimit - available) / creditLimit) * 100));
}
