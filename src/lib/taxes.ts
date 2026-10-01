// Ajuda para o Imposto de Renda: resume o ano a partir dos dados do app.
// Não substitui os informes oficiais (banco, empregador, corretora, plano de saúde).

export interface TaxTx {
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export interface TaxManualInvestment {
  asset_name: string;
  asset_type: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string;
}

export interface TaxBankInvestment {
  name: string;
  code: string | null;
  type: string;
  balance: number;
  amount_original: number | null;
  issuer: string | null;
}

export interface TaxAsset {
  name: string;
  type: string;
  /** Valor para "Bens e direitos": custo de aquisição */
  value: number;
  source: "manual" | "bank";
  /** true quando o banco não informou o custo e mostramos o saldo atual */
  estimated: boolean;
}

export interface TaxSummary {
  year: number;
  deductible: {
    health: { total: number; items: TaxTx[] };
    education: { total: number; items: TaxTx[] };
  };
  income: Array<{ category: string; total: number }>;
  incomeTotal: number;
  assets: TaxAsset[];
  assetsTotal: number;
}

const HEALTH = new Set(["Saúde"]);
const EDUCATION = new Set(["Educação"]);
const NOT_INCOME = new Set(["Transferência", "Investimento"]);

export function buildTaxSummary(input: {
  year: number;
  transactions: TaxTx[];
  manualInvestments: TaxManualInvestment[];
  bankInvestments: TaxBankInvestment[];
}): TaxSummary {
  const inYear = input.transactions.filter((t) => t.date.startsWith(`${input.year}-`));
  const pick = (cats: Set<string>) => {
    const items = inYear.filter((t) => t.type === "expense" && cats.has(t.category)).sort((a, b) => a.date.localeCompare(b.date));
    return { total: items.reduce((s, t) => s + t.amount, 0), items };
  };

  const incomeMap = new Map<string, number>();
  for (const t of inYear) {
    if (t.type !== "income" || NOT_INCOME.has(t.category)) continue;
    incomeMap.set(t.category, (incomeMap.get(t.category) ?? 0) + t.amount);
  }
  const income = [...incomeMap].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

  // Bens em 31/12: investimentos comprados até o fim do ano, pelo custo de aquisição
  const yearEnd = `${input.year}-12-31`;
  const assets: TaxAsset[] = [
    ...input.manualInvestments
      .filter((i) => i.purchase_date.slice(0, 10) <= yearEnd)
      .map((i) => ({ name: i.asset_name, type: i.asset_type, value: Number(i.quantity) * Number(i.purchase_price), source: "manual" as const, estimated: false })),
    ...input.bankInvestments
      .filter((i) => Number(i.balance) > 0)
      .map((i) => {
        const cost = i.amount_original != null && Number(i.amount_original) > 0 ? Number(i.amount_original) : null;
        return {
          name: [i.code || i.name, i.issuer].filter(Boolean).join(" · "),
          type: i.type,
          value: cost ?? Number(i.balance),
          source: "bank" as const,
          estimated: cost === null,
        };
      }),
  ];

  return {
    year: input.year,
    deductible: { health: pick(HEALTH), education: pick(EDUCATION) },
    income,
    incomeTotal: income.reduce((s, i) => s + i.total, 0),
    assets,
    assetsTotal: assets.reduce((s, a) => s + a.value, 0),
  };
}
