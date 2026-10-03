// Contas do simulador de investimentos. Funções puras, testadas em simulation.test.ts.
//
// As taxas brasileiras (Selic, CDI, IPCA + X%) são EFETIVAS ao ano: 12% a.a. não é 1% ao mês,
// é (1,12)^(1/12) − 1 ≈ 0,949% ao mês. Dividir por 12 superestima o resultado.

/** Taxa mensal equivalente a uma taxa anual efetiva (em %). Ex.: 12 → 0,9489. */
export function monthlyRateFromAnnual(annualPct: number): number {
  return (Math.pow(1 + annualPct / 100, 1 / 12) - 1) * 100;
}

/** IPCA + X% é composto, não somado: (1 + IPCA) × (1 + X) − 1. */
export function ipcaPlus(ipcaPct: number, spreadPct: number): number {
  return ((1 + ipcaPct / 100) * (1 + spreadPct / 100) - 1) * 100;
}

/** Valor futuro de um valor inicial mais aportes mensais (no fim de cada mês). */
export function futureValue(initial: number, monthly: number, annualPct: number, months: number): number {
  const i = monthlyRateFromAnnual(annualPct) / 100;
  const growth = Math.pow(1 + i, months);
  const contributions = i === 0 ? monthly * months : monthly * ((growth - 1) / i);
  return initial * growth + contributions;
}

/** Aporte mensal para chegar a `target` em `months` meses (0 se o valor inicial já basta). */
export function requiredMonthlyContribution(initial: number, target: number, annualPct: number, months: number): number {
  if (months <= 0) return 0;
  const i = monthlyRateFromAnnual(annualPct) / 100;
  const growth = Math.pow(1 + i, months);
  const remaining = target - initial * growth;
  if (remaining <= 0) return 0;
  return i === 0 ? remaining / months : remaining / ((growth - 1) / i);
}

/** Quanto um valor futuro vale em dinheiro de hoje, descontando a inflação anual (%). */
export function inTodaysMoney(value: number, inflationPct: number, months: number): number {
  return value / Math.pow(1 + inflationPct / 100, months / 12);
}

/**
 * Alíquota do IR na renda fixa (tabela regressiva) pelo prazo da aplicação, em dias.
 * Vale para CDB, Tesouro Direto e fundos de renda fixa; LCI, LCA e poupança são isentas para pessoa física.
 */
export function fixedIncomeTaxRate(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20;
  if (days <= 720) return 17.5;
  return 15;
}

/** Dias corridos aproximados em `months` meses (2 anos = 730 dias, faixa de 15%). */
export function daysInMonths(months: number): number {
  return Math.round((months * 365) / 12);
}

export interface ProjectionResult {
  /** Valor bruto no fim do prazo */
  futureValue: number;
  /** Quanto saiu do bolso (inicial + aportes) */
  totalInvested: number;
  /** Rendimento bruto */
  earnings: number;
  /** IR estimado sobre o rendimento se tudo for resgatado no fim (renda fixa tributada) */
  incomeTax: number;
  /** Valor depois do IR */
  netValue: number;
  /** Valor depois do IR, em dinheiro de hoje (descontada a inflação) */
  netValueToday: number;
}

/**
 * Projeção completa. O IR é uma estimativa simples: aplica a alíquota do prazo total sobre todo
 * o rendimento (na prática, cada aporte tem o seu prazo; os mais recentes pagam um pouco mais).
 */
export function project(
  initial: number,
  monthly: number,
  annualPct: number,
  months: number,
  opts: { inflationPct: number; taxed: boolean },
): ProjectionResult {
  const fv = futureValue(initial, monthly, annualPct, months);
  const totalInvested = initial + monthly * months;
  const earnings = fv - totalInvested;
  const incomeTax = opts.taxed && earnings > 0 ? earnings * (fixedIncomeTaxRate(daysInMonths(months)) / 100) : 0;
  const netValue = fv - incomeTax;
  return {
    futureValue: fv,
    totalInvested,
    earnings,
    incomeTax,
    netValue,
    netValueToday: inTodaysMoney(netValue, opts.inflationPct, months),
  };
}
