// Cálculos de resumo e insights a partir das transações (manuais + banco).
// Funções puras: recebem `now` para serem testáveis.
import { extractKeyword } from "@shared/categorization";
import { countsInSummary, isSpending } from "@shared/flows";

export interface InsightTransaction {
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
}

/** Entra no resumo do mês? Só transferências entre as próprias contas ficam fora (ver @shared/flows). */
export const isRealFlow = (category: string | null | undefined) => countsInSummary(category);

/** É gasto de consumo? Sem transferências e sem aportes (ver @shared/flows). */
export const isSpendingTx = (t: Pick<InsightTransaction, "type" | "category">) => t.type === "expense" && isSpending(t.category);

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Chave YYYY-MM de `n` meses antes de `now` (0 = mês atual). */
export function monthKeyAgo(now: Date, n: number): string {
  return monthKeyOf(new Date(now.getFullYear(), now.getMonth() - n, 1));
}

/** Converte YYYY-MM-DD em data local (sem o deslocamento de fuso de new Date("YYYY-MM-DD")). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const daysInMonth = (now: Date) => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

/**
 * Totais do mês. `income`/`expense`/`balance` seguem o extrato (aporte é saída, resgate é entrada).
 * `spending` é só consumo; `invested` é quanto foi para investimentos menos o que voltou deles;
 * `saved` é o que sobrou da renda depois dos gastos (aporte conta como guardado).
 * Vale sempre: balance = saved − invested.
 */
function totalsFor(txs: InsightTransaction[], month: string) {
  let income = 0;
  let expense = 0;
  let spending = 0;
  let invested = 0;
  for (const t of txs) {
    if (!t.date.startsWith(month) || !isRealFlow(t.category)) continue;
    const investment = !isSpending(t.category);
    if (t.type === "income") {
      income += t.amount;
      if (investment) invested -= t.amount;
    } else {
      expense += t.amount;
      if (investment) invested += t.amount;
      else spending += t.amount;
    }
  }
  const balance = income - expense;
  return { income, expense, balance, spending, invested, saved: balance + invested };
}

export interface MonthSummary {
  /** Entradas como no extrato (inclui resgates e dividendos) */
  income: number;
  /** Saídas como no extrato (inclui aportes) */
  expense: number;
  /** Entradas − saídas: o que ficou na conta */
  balance: number;
  /** Gastos de consumo (sem aportes) */
  spending: number;
  /** Aportes − resgates (negativo = resgatou mais do que aplicou) */
  invested: number;
  /** Renda − gastos: inclui o que foi investido */
  saved: number;
  previousSpending: number;
  /** Variação dos gastos vs mês anterior, em %; null sem base de comparação */
  spendingChangePct: number | null;
}

export function monthSummary(txs: InsightTransaction[], now: Date): MonthSummary {
  const current = totalsFor(txs, monthKeyAgo(now, 0));
  const previous = totalsFor(txs, monthKeyAgo(now, 1));
  return {
    ...current,
    previousSpending: previous.spending,
    spendingChangePct: previous.spending > 0 ? ((current.spending - previous.spending) / previous.spending) * 100 : null,
  };
}

/** Frase curta para o topo do Início. */
export function summaryHeadline(s: MonthSummary): string {
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (s.income === 0 && s.expense === 0) return "Ainda não há movimentações neste mês.";
  let text = `Você gastou ${brl(s.spending)} este mês`;
  if (s.spendingChangePct !== null && Math.abs(s.spendingChangePct) >= 1) {
    const pct = Math.round(Math.abs(s.spendingChangePct));
    text += s.spendingChangePct < 0 ? `, ${pct}% a menos que no mês passado` : `, ${pct}% a mais que no mês passado`;
  }
  text += ".";
  if (s.invested >= 0.01) text += ` Investiu ${brl(s.invested)}.`;
  else if (s.invested <= -0.01) text += ` Resgatou ${brl(-s.invested)} dos investimentos.`;
  if (s.income > 0) {
    const where = Math.abs(s.invested) >= 0.01 ? " na conta" : "";
    text += s.balance >= 0 ? ` Sobraram ${brl(s.balance)}${where}.` : ` Faltaram ${brl(-s.balance)}${where}.`;
  }
  return text;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export function topExpenseCategories(txs: InsightTransaction[], now: Date, limit = 3): CategoryTotal[] {
  const month = monthKeyAgo(now, 0);
  const map = new Map<string, number>();
  for (const t of txs) {
    if (!isSpendingTx(t) || !t.date.startsWith(month)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return Array.from(map, ([category, total]) => ({ category, total }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export interface SpendingAlert {
  category: string;
  current: number;
  average: number;
  /** Quanto acima da média, em % */
  abovePct: number;
}

/**
 * Categorias com gasto bem acima do normal: o mês atual passa 50% da média dos 3 meses anteriores,
 * com diferença de pelo menos R$ 100 (evita alerta por centavos).
 */
export function unusualSpending(txs: InsightTransaction[], now: Date): SpendingAlert[] {
  const current = new Map<string, number>();
  // Por categoria: total e em quais meses passados ela apareceu
  const past = new Map<string, { total: number; months: Set<string> }>();
  const pastMonths = [1, 2, 3].map((n) => monthKeyAgo(now, n));
  const thisMonth = monthKeyAgo(now, 0);

  for (const t of txs) {
    if (!isSpendingTx(t)) continue;
    const m = t.date.slice(0, 7);
    if (m === thisMonth) current.set(t.category, (current.get(t.category) ?? 0) + t.amount);
    else if (pastMonths.includes(m)) {
      const p = past.get(t.category) ?? { total: 0, months: new Set<string>() };
      p.total += t.amount;
      p.months.add(m);
      past.set(t.category, p);
    }
  }

  const alerts: SpendingAlert[] = [];
  for (const [category, value] of current) {
    const p = past.get(category);
    if (!p || p.total <= 0) continue;
    // Média dos meses em que a categoria apareceu (um aluguel lançado só uma vez não vira média baixa)
    const average = p.total / p.months.size;
    if (value > average * 1.5 && value - average >= 100) {
      alerts.push({ category, current: value, average, abovePct: ((value - average) / average) * 100 });
    }
  }
  return alerts.sort((a, b) => b.current - b.average - (a.current - a.average));
}

export interface RecurringCharge {
  name: string;
  category: string;
  monthlyAmount: number;
  months: number;
}

/**
 * Cobranças recorrentes (assinaturas, mensalidades): mesma descrição em pelo menos 2 dos últimos
 * 3 meses (incluindo o atual), com valores parecidos (variação até 15%).
 */
export function recurringCharges(txs: InsightTransaction[], now: Date): RecurringCharge[] {
  const window = [0, 1, 2].map((n) => monthKeyAgo(now, n));
  const groups = new Map<string, { name: string; category: string; byMonth: Map<string, number> }>();

  for (const t of txs) {
    // Estornos (valor negativo) não formam cobrança recorrente
    if (!isSpendingTx(t) || t.amount <= 0) continue;
    const m = t.date.slice(0, 7);
    if (!window.includes(m)) continue;
    const key = extractKeyword(t.description);
    if (!key) continue;
    const g = groups.get(key) ?? { name: t.description, category: t.category, byMonth: new Map() };
    g.byMonth.set(m, (g.byMonth.get(m) ?? 0) + t.amount);
    groups.set(key, g);
  }

  const result: RecurringCharge[] = [];
  for (const g of groups.values()) {
    const values = [...g.byMonth.values()];
    if (values.length < 2) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max > min * 1.15) continue;
    result.push({
      name: g.name,
      category: g.category,
      monthlyAmount: values.reduce((s, v) => s + v, 0) / values.length,
      months: values.length,
    });
  }
  return result.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Gasto total por dia da semana nos últimos `months` meses (inclui o atual). */
export function spendingByWeekday(txs: InsightTransaction[], now: Date, months = 3): Array<{ day: string; total: number }> {
  const window = Array.from({ length: months }, (_, n) => monthKeyAgo(now, n));
  const totals = new Array(7).fill(0);
  for (const t of txs) {
    if (!isSpendingTx(t) || !window.includes(t.date.slice(0, 7))) continue;
    totals[parseLocalDate(t.date).getDay()] += t.amount;
  }
  return totals.map((total, i) => ({ day: WEEKDAYS[i], total }));
}

export interface MonthForecast {
  spentSoFar: number;
  projected: number;
  previousAverage: number | null;
}

/**
 * Previsão de gastos até o fim do mês. Na primeira semana o ritmo diário engana,
 * então usa a média dos meses anteriores (se houver) como piso.
 */
export function monthForecast(txs: InsightTransaction[], now: Date): MonthForecast {
  const spentSoFar = totalsFor(txs, monthKeyAgo(now, 0)).spending;
  const pastTotals = [1, 2, 3].map((n) => totalsFor(txs, monthKeyAgo(now, n)).spending).filter((v) => v > 0);
  const previousAverage = pastTotals.length ? pastTotals.reduce((s, v) => s + v, 0) / pastTotals.length : null;

  const day = now.getDate();
  const linear = (spentSoFar / day) * daysInMonth(now);
  let projected = linear;
  if (day < 7 && previousAverage !== null) projected = Math.max(spentSoFar, previousAverage);
  return { spentSoFar, projected, previousAverage };
}

/**
 * Média de quanto a pessoa consegue guardar por mês nos últimos `months` meses completos (para o simulador):
 * renda menos gastos. O que já foi investido conta como guardado.
 */
export function averageMonthlySavings(txs: InsightTransaction[], now: Date, months = 3): number | null {
  const balances: number[] = [];
  for (let n = 1; n <= months; n++) {
    const t = totalsFor(txs, monthKeyAgo(now, n));
    if (t.income > 0 || t.expense > 0) balances.push(t.saved);
  }
  if (!balances.length) return null;
  return balances.reduce((s, v) => s + v, 0) / balances.length;
}
