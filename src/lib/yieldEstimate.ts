// Rendimento estimado pela variação do saldo dos investimentos, quando o banco não informa.
// rendimento = (saldo final − saldo inicial) − aportes + resgates no período.
// Aporte/resgate = transação da conta ligada a investimento (dinheiro que foi para / voltou da caixinha).

export interface BalancePoint { date: string; balance: number }
export interface AccountTx { date: string; amount: number; type: string; description: string; category?: string | null }

const INVESTMENT_FLOW = /investiment|caixinha|aplica[cç][aã]o|resgate|guardad|cdb|tesouro|rdb|lci|lca/i;

/** A transação move dinheiro entre a conta e os investimentos? */
export function isInvestmentFlow(tx: AccountTx): boolean {
  return tx.category === "Investimento" || INVESTMENT_FLOW.test(tx.description);
}

export interface YieldEstimate {
  value: number;
  since: string;
  until: string;
  /** Aportes (+) e resgates (−) descontados */
  netFlows: number;
}

/** null enquanto não houver ao menos dois dias de histórico. */
export function estimateYield(history: BalancePoint[], txs: AccountTx[]): YieldEstimate | null {
  const points = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  // Movimentos depois do primeiro registro e até o último (o saldo do dia inicial já os inclui)
  const netFlows = txs
    .filter((t) => t.date > first.date && t.date <= last.date && isInvestmentFlow(t))
    .reduce((s, t) => s + (t.type === "expense" ? Math.abs(t.amount) : -Math.abs(t.amount)), 0);
  const value = Math.round((last.balance - first.balance - netFlows) * 100) / 100;
  return { value, since: first.date, until: last.date, netFlows };
}
