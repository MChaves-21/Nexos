// Categorização por regras de palavras-chave.
// Módulo puro (sem imports) usado tanto pelas Edge Functions (Deno) quanto pelo front (via alias @shared).

export const CATEGORIES = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
  "Lazer", "Vestuário", "Serviços", "Assinaturas", "Compras",
  "Transferência", "Investimento", "Salário", "Freelance", "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategorizationRule {
  keyword: string;
  category: string;
}

// Regras padrão, avaliadas depois das regras aprendidas do usuário.
// As palavras-chave são comparadas com a descrição normalizada (minúsculas, sem acento).
export const DEFAULT_RULES: CategorizationRule[] = [
  { keyword: "ifood", category: "Alimentação" },
  { keyword: "rappi", category: "Alimentação" },
  { keyword: "restaurante", category: "Alimentação" },
  { keyword: "padaria", category: "Alimentação" },
  { keyword: "supermercado", category: "Alimentação" },
  { keyword: "mercado", category: "Alimentação" },
  { keyword: "assai", category: "Alimentação" },
  { keyword: "atacadao", category: "Alimentação" },
  { keyword: "carrefour", category: "Alimentação" },
  { keyword: "pao de acucar", category: "Alimentação" },
  { keyword: "uber", category: "Transporte" },
  { keyword: "99app", category: "Transporte" },
  { keyword: "99 pop", category: "Transporte" },
  { keyword: "posto", category: "Transporte" },
  { keyword: "combustivel", category: "Transporte" },
  { keyword: "ipiranga", category: "Transporte" },
  { keyword: "shell", category: "Transporte" },
  { keyword: "estacionamento", category: "Transporte" },
  { keyword: "sem parar", category: "Transporte" },
  { keyword: "aluguel", category: "Moradia" },
  { keyword: "condominio", category: "Moradia" },
  { keyword: "enel", category: "Moradia" },
  { keyword: "energia", category: "Moradia" },
  { keyword: "cagece", category: "Moradia" },
  { keyword: "sabesp", category: "Moradia" },
  { keyword: "farmacia", category: "Saúde" },
  { keyword: "drogasil", category: "Saúde" },
  { keyword: "droga raia", category: "Saúde" },
  { keyword: "pague menos", category: "Saúde" },
  { keyword: "hospital", category: "Saúde" },
  { keyword: "laboratorio", category: "Saúde" },
  { keyword: "unimed", category: "Saúde" },
  { keyword: "hapvida", category: "Saúde" },
  { keyword: "faculdade", category: "Educação" },
  { keyword: "udemy", category: "Educação" },
  { keyword: "alura", category: "Educação" },
  { keyword: "livraria", category: "Educação" },
  { keyword: "netflix", category: "Assinaturas" },
  { keyword: "spotify", category: "Assinaturas" },
  { keyword: "disney", category: "Assinaturas" },
  { keyword: "hbo", category: "Assinaturas" },
  { keyword: "prime video", category: "Assinaturas" },
  { keyword: "amazon prime", category: "Assinaturas" },
  { keyword: "youtube premium", category: "Assinaturas" },
  { keyword: "google one", category: "Assinaturas" },
  { keyword: "icloud", category: "Assinaturas" },
  { keyword: "cinema", category: "Lazer" },
  { keyword: "ingresso", category: "Lazer" },
  { keyword: "steam", category: "Lazer" },
  { keyword: "playstation", category: "Lazer" },
  { keyword: "renner", category: "Vestuário" },
  { keyword: "riachuelo", category: "Vestuário" },
  { keyword: "c&a", category: "Vestuário" },
  { keyword: "zara", category: "Vestuário" },
  { keyword: "shein", category: "Vestuário" },
  { keyword: "mercadolivre", category: "Compras" },
  { keyword: "mercado livre", category: "Compras" },
  { keyword: "amazon", category: "Compras" },
  { keyword: "shopee", category: "Compras" },
  { keyword: "aliexpress", category: "Compras" },
  { keyword: "magalu", category: "Compras" },
  { keyword: "claro", category: "Serviços" },
  { keyword: "vivo", category: "Serviços" },
  { keyword: "tim ", category: "Serviços" },
  { keyword: "internet", category: "Serviços" },
  { keyword: "salario", category: "Salário" },
  { keyword: "pagamento de salario", category: "Salário" },
  { keyword: "aplicacao", category: "Investimento" },
  { keyword: "resgate", category: "Investimento" },
  { keyword: "rdb", category: "Investimento" },
  { keyword: "cdb", category: "Investimento" },
  { keyword: "tesouro", category: "Investimento" },
  { keyword: "corretora", category: "Investimento" },
  { keyword: "pagamento recebido", category: "Transferência" },
  { keyword: "pagamento de fatura", category: "Transferência" },
  { keyword: "transferencia", category: "Transferência" },
  { keyword: "pix", category: "Transferência" },
  { keyword: "ted", category: "Transferência" },
];

/** Minúsculas, sem acentos e com espaços simples. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "para", "pra", "com",
  "compra", "no", "na", "debito", "credito", "cartao", "parcela",
]);

/**
 * Extrai a palavra-chave usada para aprender uma regra a partir de uma descrição.
 * Ex.: "UBER *TRIP HELP.UBER.COM 12/05" -> "uber trip help"
 *      "Loja Exemplo - Parcela 2/5"     -> "loja exemplo"
 */
export function extractKeyword(description: string): string {
  const words = matchText(normalizeText(description).replace(/parcela\s*\d+\s*\/\s*\d+/g, " "))
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(" ");
}

/** Texto para comparação: normalizado e sem pontuação ("UBER *TRIP" -> "uber trip"). */
function matchText(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchesKeyword(normalizedDescription: string, keyword: string): boolean {
  const k = matchText(keyword);
  if (!k) return false;
  // Palavras curtas (pix, ted, rdb...) precisam casar como palavra inteira
  if (k.length <= 4) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalizedDescription);
  }
  return normalizedDescription.includes(k);
}

/**
 * Categoriza pela primeira regra que casar: regras do usuário primeiro, depois as padrão.
 * Em cada grupo, keywords mais longas (mais específicas) são testadas antes.
 */
export function categorizeByRules(
  description: string,
  userRules: CategorizationRule[] = [],
  defaultRules: CategorizationRule[] = DEFAULT_RULES,
): { category: string; fromUserRule: boolean } | null {
  const normalized = matchText(description);
  const byLength = (a: CategorizationRule, b: CategorizationRule) => b.keyword.length - a.keyword.length;
  for (const rule of [...userRules].sort(byLength)) {
    if (matchesKeyword(normalized, rule.keyword)) return { category: rule.category, fromUserRule: true };
  }
  // "mercado livre" deve vencer "mercado", "amazon prime" deve vencer "amazon"
  for (const rule of [...defaultRules].sort(byLength)) {
    if (matchesKeyword(normalized, rule.keyword)) return { category: rule.category, fromUserRule: false };
  }
  return null;
}

/**
 * Resposta da IA validada: só categorias conhecidas, índice dentro do lote e confiança entre 0 e 1.
 * A IA lê descrições vindas do banco (texto de terceiros), então a saída nunca é confiada como veio.
 */
export function sanitizeAiCategories(raw: unknown, batchSize: number): Array<{ index: number; category: Category; confidence: number }> {
  const list = (raw as { categories?: unknown })?.categories;
  if (!Array.isArray(list)) return [];
  const known = new Set<string>(CATEGORIES);
  const seen = new Set<number>();
  const out: Array<{ index: number; category: Category; confidence: number }> = [];
  for (const item of list) {
    const { index, category, confidence } = (item ?? {}) as { index?: unknown; category?: unknown; confidence?: unknown };
    if (!Number.isInteger(index) || (index as number) < 1 || (index as number) > batchSize || seen.has(index as number)) continue;
    if (typeof category !== "string" || !known.has(category)) continue;
    const c = typeof confidence === "number" && Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5;
    seen.add(index as number);
    out.push({ index: index as number, category: category as Category, confidence: Math.round(c * 100) / 100 });
  }
  return out;
}
