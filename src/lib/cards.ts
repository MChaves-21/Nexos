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

/** "Loja X - Parcela 2/5" e "LOJA X 3/5" viram a mesma compra (o valor é comparado à parte, com tolerância). */
const purchaseKey = (tx: InstallmentTx, total: number) =>
  [tx.cardKey, normalizeText(tx.description).replace(/parcela\s*\d+\s*\/\s*\d+/g, "").replace(/\d+\s*\/\s*\d+/g, "").replace(/[^a-z0-9]+/g, " ").trim(), total].join("|");

/** A 1ª parcela costuma ter alguns centavos a mais (arredondamento): valores próximos são a mesma compra. */
const sameInstallmentValue = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.02);

/**
 * Projeta as parcelas restantes de cada compra parcelada nos meses seguintes ao atual.
 * O banco manda uma transação por parcela (2/5, depois 3/5...): usa só a mais recente de cada compra,
 * senão as parcelas futuras seriam contadas mais de uma vez.
 */
export function projectInstallments(txs: InstallmentTx[], currentPeriod: string, months = 6): FutureMonth[] {
  const groups = new Map<string, Array<{ tx: InstallmentTx; n: number; total: number }>>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !tx.installment_info) continue;
    const m = tx.installment_info.match(/^(\d+)\/(\d+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    const total = Number(m[2]);
    if (n >= total) continue;
    const key = purchaseKey(tx, total);
    const list = groups.get(key) ?? [];
    // Mesma loja e mesmo nº de parcelas, mas valor bem diferente = outra compra
    const prev = list.find((p) => sameInstallmentValue(Number(p.tx.amount), Number(tx.amount)) && p.n !== n);
    if (!prev) list.push({ tx, n, total });
    else if (n > prev.n) Object.assign(prev, { tx, n });
    groups.set(key, list);
  }
  const latest = [...groups.values()].flat();

  const window = Array.from({ length: months }, (_, i) => addMonths(currentPeriod, i + 1));
  const byPeriod = new Map<string, FutureMonth>(window.map((p) => [p, { period: p, total: 0, items: [] }]));
  for (const { tx, n, total } of latest) {
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
