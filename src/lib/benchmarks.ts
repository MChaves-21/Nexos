// Comparação da carteira com CDI e inflação (IPCA), usando as taxas anuais atuais.
// É uma estimativa: aplica a taxa de hoje a todo o período em que o dinheiro ficou aplicado.

export interface BenchmarkPosition {
  invested: number;
  current: number;
  /** YYYY-MM-DD */
  purchaseDate: string;
}

export interface BenchmarkResult {
  invested: number;
  current: number;
  returnPct: number;
  /** Tempo médio aplicado, em anos, ponderado pelo valor investido */
  years: number;
  cdiPct: number;
  ipcaPct: number;
  /** Rentabilidade como % do CDI (100 = igual ao CDI); null se o CDI do período for ~0 */
  pctOfCdi: number | null;
  beatsInflation: boolean;
}

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function compareWithBenchmarks(
  positions: BenchmarkPosition[],
  rates: { cdi: number; ipca: number },
  now: Date = new Date(),
): BenchmarkResult | null {
  const valid = positions.filter((p) => p.invested > 0);
  const invested = valid.reduce((s, p) => s + p.invested, 0);
  if (invested <= 0) return null;
  const current = valid.reduce((s, p) => s + p.current, 0);

  const years =
    valid.reduce((s, p) => {
      const [y, m, d] = p.purchaseDate.slice(0, 10).split("-").map(Number);
      const held = Math.max(0, (now.getTime() - new Date(y, m - 1, d).getTime()) / MS_PER_YEAR);
      return s + held * p.invested;
    }, 0) / invested;

  const compound = (annualPct: number) => (Math.pow(1 + annualPct / 100, years) - 1) * 100;
  const returnPct = ((current - invested) / invested) * 100;
  const cdiPct = compound(rates.cdi);
  const ipcaPct = compound(rates.ipca);

  return {
    invested,
    current,
    returnPct,
    years,
    cdiPct,
    ipcaPct,
    pctOfCdi: cdiPct > 0.01 ? (returnPct / cdiPct) * 100 : null,
    beatsInflation: returnPct > ipcaPct,
  };
}
