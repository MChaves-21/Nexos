// Regras que evitam contar o mesmo dinheiro duas vezes. Módulo puro, usado pelo app e pelo servidor.
//
// 1) Transferência entre contas próprias: saída numa conta e entrada do mesmo valor em outra conta
//    da mesma pessoa, com até 2 dias de diferença. Não é gasto nem ganho.
// 2) Estorno no cartão: crédito na fatura que não é o pagamento dela. Abate o gasto, não é renda.
// 3) Lançamento manual repetido: a pessoa lançou à mão e depois a mesma transação chegou pelo banco.
import { normalizeText } from "./categorization.ts";

export interface LedgerRow {
  id: string;
  type: "income" | "expense";
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  category: string;
  /** Conta de origem (id da conta no banco ou do arquivo importado); null quando não se sabe */
  accountKey: string | null;
  /** Escolhida pela pessoa: nunca é trocada automaticamente */
  locked?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysApart(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.abs(toUtc(a) - toUtc(b)) / DAY_MS;
}

const cents = (v: number) => Math.round(Math.abs(v) * 100);

/** Agrupa por valor em centavos: só compara linhas com o mesmo valor (evita O(n²) em históricos grandes). */
function byAmount(rows: LedgerRow[]): Map<number, LedgerRow[]> {
  const map = new Map<number, LedgerRow[]>();
  for (const r of rows) {
    const k = cents(r.amount);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

// Palavras que aparecem em qualquer Pix/TED e não identificam ninguém
const GENERIC = new Set([
  "transferencia", "transf", "enviada", "enviado", "recebida", "recebido", "pelo", "por", "via", "pix", "ted", "doc",
  "pagamento", "compra", "debito", "credito", "cartao", "conta", "para", "com", "das", "dos", "ltda", "s/a",
]);

/** Palavras que identificam a outra parte (3+ letras, sem números nem palavras genéricas). */
export function significantTokens(description: string): Set<string> {
  return new Set(
    normalizeText(description)
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 3 && !/\d/.test(w) && !GENERIC.has(w)),
  );
}

const sharesToken = (a: Set<string>, b: Set<string>) => [...a].some((t) => b.has(t));

/**
 * Pares saída/entrada entre contas diferentes da pessoa (mesmo valor, até 2 dias).
 * Se um dos lados já é Transferência (ex.: "Pagamento recebido" na fatura), basta valor e data;
 * senão as descrições precisam ter uma palavra em comum (normalmente o nome da própria pessoa),
 * para não juntar um Pix pago a alguém com outro recebido de outra pessoa no mesmo valor.
 * Devolve os ids que devem virar Transferência.
 */
export function findOwnTransfers(rows: LedgerRow[], maxDays = 2): Set<string> {
  const candidates = rows.filter((r) => r.accountKey && r.category !== "Investimento");
  const incomes = byAmount(candidates.filter((r) => r.type === "income"));
  const used = new Set<string>();
  const out = new Set<string>();
  const tokens = new Map<string, Set<string>>();
  const tokensOf = (r: LedgerRow) => {
    let t = tokens.get(r.id);
    if (!t) tokens.set(r.id, (t = significantTokens(r.description)));
    return t;
  };

  const expenses = candidates.filter((r) => r.type === "expense").sort((a, b) => a.date.localeCompare(b.date));
  for (const e of expenses) {
    let best: LedgerRow | null = null;
    let bestGap = Infinity;
    for (const i of incomes.get(cents(e.amount)) ?? []) {
      if (used.has(i.id) || i.accountKey === e.accountKey) continue;
      const gap = daysApart(e.date, i.date);
      if (gap > maxDays || gap >= bestGap) continue;
      const alreadyTransfer = e.category === "Transferência" || i.category === "Transferência";
      if (!alreadyTransfer && !sharesToken(tokensOf(e), tokensOf(i))) continue;
      // O que a pessoa escolheu como outra categoria não vira transferência
      if ((e.locked && e.category !== "Transferência") || (i.locked && i.category !== "Transferência")) continue;
      best = i;
      bestGap = gap;
    }
    if (best) {
      used.add(best.id);
      out.add(e.id);
      out.add(best.id);
    }
  }
  return out;
}

/** Crédito no cartão que não é o pagamento da fatura: estorno ou cashback, abate o gasto. */
export function isCardRefund(row: Pick<LedgerRow, "type" | "category">, isCardAccount: boolean): boolean {
  return isCardAccount && row.type === "income" && row.category !== "Transferência";
}

/**
 * Lançamentos manuais que repetem uma transação do banco: mesmo tipo e valor, até 3 dias de
 * diferença e uma palavra em comum na descrição. Cada transação do banco cobre um manual só.
 * Devolve id manual -> id do banco.
 */
export function findManualDuplicates(manual: LedgerRow[], bank: LedgerRow[], maxDays = 3): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  const pool = byAmount(bank);
  for (const m of manual) {
    const mTokens = significantTokens(m.description);
    if (!mTokens.size) continue;
    let best: LedgerRow | null = null;
    let bestGap = Infinity;
    for (const b of pool.get(cents(m.amount)) ?? []) {
      if (used.has(b.id) || b.type !== m.type) continue;
      const gap = daysApart(m.date, b.date);
      if (gap > maxDays || gap >= bestGap) continue;
      if (!sharesToken(mTokens, significantTokens(b.description))) continue;
      best = b;
      bestGap = gap;
    }
    if (best) {
      used.add(best.id);
      out.set(m.id, best.id);
    }
  }
  return out;
}
