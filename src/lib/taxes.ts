// Ajuda para o Imposto de Renda: resume o ano a partir dos dados do app.
// Não substitui os informes oficiais (banco, empregador, corretora, plano de saúde).
import { normalizeText } from "@shared/categorization";

/**
 * Limite anual de dedução com educação por pessoa (titular e cada dependente).
 * Valor das declarações recentes; conferir a cada ano no programa da Receita.
 */
export const EDUCATION_CAP_PER_PERSON = 3561.5;

// Saúde que NÃO deduz: remédio comprado em farmácia, academia, ótica, suplementos
const NOT_DEDUCTIBLE_HEALTH =
  /farmac|drogari|drogasil|droga ?raia|pague menos|panvel|pacheco|nissei|ultrafarma|sao joao farm|academia|smart ?fit|bluefit|gympass|wellhub|totalpass|otica|suplement/;
// Sinais claros de serviço de saúde dedutível: vencem a lista acima ("ACADEMIA VILA CONSULTA CLINICA ODONTOLOGICA")
const DEDUCTIBLE_HEALTH_HINT =
  /clinic|odonto|dentist|consult|hospital|laborat|medic|psicolog|fisioter|fonoaud|terapeut|exame|unimed|hapvida|amil|bradesco saude|sulamerica|plano de saude/;
// Educação que NÃO deduz: cursos livres, idiomas, livros, material, autoescola
const NOT_DEDUCTIBLE_EDUCATION =
  /udemy|alura|coursera|hotmart|domestika|rocketseat|livrari|livro|amazon|idioma|ingles|espanhol|wizard|ccaa|fisk|\bcna\b|duolingo|curso livre|kumon|autoescola|auto escola|papelaria|material escolar/;

/** Rendimentos que normalmente são tributáveis; os demais aparecem para conferir. */
const TAXABLE_INCOME = new Set(["Salário", "Freelance"]);

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

export interface TaxGroup {
  total: number;
  items: TaxTx[];
}

export interface TaxSummary {
  year: number;
  deductible: {
    health: TaxGroup;
    education: TaxGroup & {
      /** Limite anual por pessoa; o total dedutível do titular sozinho é min(total, cap) */
      cap: number;
    };
  };
  /** Gastos em Saúde/Educação que a Receita não aceita (farmácia, academia, cursos livres, livros...) */
  notDeductible: TaxGroup;
  income: Array<{ category: string; total: number; taxable: boolean }>;
  incomeTotal: number;
  /** Só Salário e Freelance */
  taxableIncomeTotal: number;
  assets: TaxAsset[];
  assetsTotal: number;
  /**
   * Posições do banco que não entram porque são as de hoje, não as de 31/12 de um ano já encerrado.
   * Para esses anos, o valor certo está no informe de rendimentos da instituição.
   */
  bankAssetsOmitted: number;
}

const HEALTH = new Set(["Saúde"]);
const EDUCATION = new Set(["Educação"]);
const NOT_INCOME = new Set(["Transferência", "Investimento"]);

export function buildTaxSummary(input: {
  year: number;
  transactions: TaxTx[];
  manualInvestments: TaxManualInvestment[];
  bankInvestments: TaxBankInvestment[];
  /** Ano corrente (para saber se as posições de hoje servem como as de 31/12) */
  currentYear?: number;
}): TaxSummary {
  const currentYear = input.currentYear ?? new Date().getFullYear();
  const inYear = input.transactions.filter((t) => t.date.startsWith(`${input.year}-`));
  const group = (items: TaxTx[]): TaxGroup => {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    // Estornos (valor negativo) abatem; o total nunca fica negativo
    return { total: Math.max(0, sorted.reduce((s, t) => s + t.amount, 0)), items: sorted };
  };
  const notDeductibleItems: TaxTx[] = [];
  const pick = (cats: Set<string>, excluded: RegExp) => {
    const items: TaxTx[] = [];
    for (const t of inYear) {
      if (t.type !== "expense" || !cats.has(t.category)) continue;
      const text = normalizeText(t.description);
      const clearlyHealth = cats === HEALTH && DEDUCTIBLE_HEALTH_HINT.test(text);
      if (!clearlyHealth && excluded.test(text)) notDeductibleItems.push(t);
      else items.push(t);
    }
    return group(items);
  };
  const health = pick(HEALTH, NOT_DEDUCTIBLE_HEALTH);
  const education = pick(EDUCATION, NOT_DEDUCTIBLE_EDUCATION);

  const incomeMap = new Map<string, number>();
  for (const t of inYear) {
    if (t.type !== "income" || NOT_INCOME.has(t.category)) continue;
    incomeMap.set(t.category, (incomeMap.get(t.category) ?? 0) + t.amount);
  }
  const income = [...incomeMap]
    .map(([category, total]) => ({ category, total, taxable: TAXABLE_INCOME.has(category) }))
    .sort((a, b) => Number(b.taxable) - Number(a.taxable) || b.total - a.total);

  // Bens em 31/12: investimentos comprados até o fim do ano, pelo custo de aquisição
  const yearEnd = `${input.year}-12-31`;
  const assets: TaxAsset[] = [
    ...input.manualInvestments
      .filter((i) => i.purchase_date.slice(0, 10) <= yearEnd)
      .map((i) => ({ name: i.asset_name, type: i.asset_type, value: Number(i.quantity) * Number(i.purchase_price), source: "manual" as const, estimated: false })),
    // Posição do banco é a de hoje: só serve para o ano corrente
    ...input.bankInvestments
      .filter((i) => Number(i.balance) > 0 && input.year >= currentYear)
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
    deductible: { health, education: { ...education, cap: EDUCATION_CAP_PER_PERSON } },
    notDeductible: group(notDeductibleItems),
    income,
    incomeTotal: income.reduce((s, i) => s + i.total, 0),
    taxableIncomeTotal: income.filter((i) => i.taxable).reduce((s, i) => s + i.total, 0),
    assets,
    assetsTotal: assets.reduce((s, a) => s + a.value, 0),
    bankAssetsOmitted: input.year < currentYear ? input.bankInvestments.filter((i) => Number(i.balance) > 0).length : 0,
  };
}
