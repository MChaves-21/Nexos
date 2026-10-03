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
  // Só o que é com certeza dinheiro trocando de lugar entre as próprias contas.
  // Pix/TED/"transferência" sozinhos NÃO entram: no Brasil quase todo pagamento e recebimento é Pix
  // (aluguel, mercado, salário). Transferências entre contas próprias são detectadas em @shared/ledger.
  { keyword: "pagamento recebido", category: "Transferência" },
  { keyword: "pagamento de fatura", category: "Transferência" },
  { keyword: "pagamento da fatura", category: "Transferência" },
  { keyword: "mesma titularidade", category: "Transferência" },
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
  const text = matchText(normalizeText(description).replace(/parcela\s*\d+\s*\/\s*\d+/g, " ")).replace(PAYMENT_PREFIX, "");
  const words = text
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !STOP_WORDS.has(w));
  // Só palavras genéricas ("transferencia enviada pelo") valeriam para todo Pix: não aprende nada
  if (words.every((w) => GENERIC_PAYMENT_WORDS.has(w))) return "";
  return words.slice(0, 3).join(" ");
}

/**
 * Início das descrições de Pix/TED ("Transferência enviada pelo Pix - FULANO", "Pix recebido de LOJA").
 * A regra aprendida tem que ser sobre quem recebeu/pagou, não sobre o meio de pagamento.
 */
const PAYMENT_PREFIX =
  /^(?:(?:transferencia|transf|pix|ted|doc)(?: (?:enviad[ao]|recebid[ao]|realizad[ao]|agendad[ao]))?(?: (?:pelo|por|via) (?:pix|ted|doc))?(?: (?:de|para|a))?\s*)+/;

const GENERIC_PAYMENT_WORDS = new Set([
  "transferencia", "transf", "pix", "ted", "doc", "enviada", "enviado", "recebida", "recebido", "pelo", "por", "via",
  "pagamento", "conta", "saldo",
]);

/** Texto para comparação: normalizado e sem pontuação ("UBER *TRIP" -> "uber trip"). */
function matchText(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
}

function matchesKeyword(normalizedDescription: string, keyword: string): boolean {
  const k = matchText(keyword);
  if (!k) return false;
  // Palavra-chave aprendida sem as palavras de ligação ("padaria joao" para "PADARIA DO JOAO"):
  // cada palavra precisa aparecer inteira, na mesma ordem
  if (k.includes(" ") && !normalizedDescription.includes(k)) {
    const words = normalizedDescription.split(" ");
    let at = 0;
    for (const w of k.split(" ")) {
      const found = words.indexOf(w, at);
      if (found < 0) return false;
      at = found + 1;
    }
    return true;
  }
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

/**
 * A própria fonte diz que é dinheiro entre contas da mesma pessoa ou pagamento da fatura?
 * A Pluggy usa categorias como "Same person transfer - PIX" e "Credit card payment".
 */
export function isOwnTransferCategory(originalCategory: string | null | undefined): boolean {
  if (!originalCategory) return false;
  return /same person|credit card payment|mesma titularidade|pagamento de fatura/i.test(originalCategory);
}

// Categoria da Pluggy (em inglês) → categoria do Nexos. Ordem importa: o mais específico primeiro.
const PLUGGY_CATEGORY_MAP: Array<[RegExp, Category]> = [
  [/same person|credit card payment/i, "Transferência"],
  [/salary|retirement|pension|government aid/i, "Salário"],
  [/entrepreneurial|freelanc/i, "Freelance"],
  [/dividend|interest|investment|fixed income|mutual fund|variable income|margin/i, "Investimento"],
  [/pharmac|health|dentist|hospital|clinic|optometr|wellness|gym|fitness|sa[uú]de/i, "Saúde"],
  [/bookstore/i, "Compras"],
  [/education|course|university|school|kindergarten|educa[cç]/i, "Educação"],
  [/grocer|food|eating|restaurant|delivery/i, "Alimentação"],
  [/gas station|parking|toll|vehicle|automotive|car rental|taxi|ride-hailing|transport|\bbus\b|bicycle|airport|airline/i, "Transporte"],
  [/\brent\b|housing|utilit|water|electric|^gas$|houseware|urban land|^casa$/i, "Moradia"],
  [/streaming|digital service|subscription/i, "Assinaturas"],
  [/leisure|ticket|gaming|travel|accommodation|sport|gambling|lottery|\bbet\b|mileage|lazer|viage/i, "Lazer"],
  [/cloth|vestu/i, "Vestuário"],
  [/shopping|electronic|eletr[oô]nic|\bpet\b|kids|toys|office/i, "Compras"],
  [/telecom|internet|mobile|\btv\b|service|servi[cç]o|\bfees?\b|insurance|\btax/i, "Serviços"],
];

/** Converte a categoria da fonte (Pluggy em inglês ou coluna do CSV) para uma do Nexos; null se não souber. */
export function mapSourceCategory(originalCategory: string | null | undefined): Category | null {
  const original = originalCategory?.trim();
  if (!original) return null;
  if ((CATEGORIES as readonly string[]).includes(original)) return original as Category;
  for (const [re, category] of PLUGGY_CATEGORY_MAP) if (re.test(original)) return category;
  // Fatura do Nubank em CSV traz categorias em português ("restaurante", "supermercado"...)
  const byRule = categorizeByRules(original, []);
  return byRule && byRule.category !== "Transferência" ? (byRule.category as Category) : null;
}

/** Categoria exibida: a escolhida (pessoa, regra ou IA) ou, sem ela, a traduzida da fonte. */
export function resolveCategory(aiCategory: string | null | undefined, originalCategory: string | null | undefined): string {
  return aiCategory || mapSourceCategory(originalCategory) || "Outros";
}

/**
 * Categoria na hora de gravar uma transação vinda do banco:
 * regras da pessoa > a fonte diz que é entre contas próprias > regras padrão. null = vai para a IA.
 */
export function categorizeIncoming(
  description: string,
  originalCategory: string | null | undefined,
  userRules: CategorizationRule[] = [],
): { category: string; fromUserRule: boolean } | null {
  const own = categorizeByRules(description, userRules, []);
  if (own) return own;
  if (isOwnTransferCategory(originalCategory)) return { category: "Transferência", fromUserRule: false };
  return categorizeByRules(description, []);
}
