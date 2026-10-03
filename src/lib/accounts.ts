// Como mostrar as contas que vêm do banco. A Pluggy usa o nome jurídico da instituição
// (ex.: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)") e nomes curtos de
// cartão (ex.: "gold"); aqui vira algo que qualquer pessoa entende.

export interface BankAccountLike {
  name: string;
  type: string; // BANK | CREDIT
  subtype?: string | null;
  balance: number;
  credit_limit?: number | null;
  available_credit_limit?: number | null;
}

const capitalize = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** "Conta corrente", "Poupança" ou "Cartão Gold". */
export function accountTitle(a: BankAccountLike): string {
  if (a.type === "CREDIT") {
    const name = a.name.trim();
    const short = name.length <= 24 && !/s\.?a\.?|institui|pagamentos/i.test(name);
    return short ? `Cartão ${capitalize(name.replace(/^cart[aã]o\s+/i, ""))}` : "Cartão de crédito";
  }
  const sub = (a.subtype ?? "").toUpperCase();
  if (sub === "SAVINGS_ACCOUNT" || /poupan/i.test(a.name)) return "Poupança";
  return "Conta corrente";
}

/** O que o valor significa: saldo da conta ou fatura do cartão. */
export function amountLabel(a: BankAccountLike): string {
  return a.type === "CREDIT" ? "Fatura atual" : "Saldo";
}

/** Limite usado do cartão (quando o banco informa). */
export function creditUsage(a: BankAccountLike): { used: number; limit: number } | null {
  if (a.type !== "CREDIT" || !a.credit_limit || a.available_credit_limit == null) return null;
  return { used: Math.max(0, a.credit_limit - a.available_credit_limit), limit: a.credit_limit };
}
