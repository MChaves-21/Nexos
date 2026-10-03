// Junta a carteira cadastrada à mão com as posições lidas do banco (Open Finance)
// num único formato, para que totais, gráficos e alocação usem tudo.
import type { Investment } from "@/hooks/useInvestments";
import type { SyncedInvestment } from "@/hooks/useBankConnections";

export interface PortfolioItem extends Investment {
  origin: "manual" | "bank";
  /** Quando veio do banco: instituição/emissor, para exibir */
  issuer?: string | null;
  /** Sabemos quanto foi aplicado? Sem isso o ganho é desconhecido (não zero). */
  gainKnown: boolean;
}

/**
 * Rendimento de uma posição do banco: o informado ou saldo − valor aplicado.
 * null = o banco não informou (comum nas caixinhas do Nubank via Open Finance).
 */
export function bankProfit(inv: Pick<SyncedInvestment, "balance" | "amount_profit" | "amount_original">): number | null {
  if (inv.amount_profit != null) return Number(inv.amount_profit);
  if (inv.amount_original != null && Number(inv.amount_original) > 0) return Number(inv.balance) - Number(inv.amount_original);
  return null;
}

/** Tipo da Pluggy -> tipos usados na carteira do Nexos. */
export function bankAssetType(inv: Pick<SyncedInvestment, "type" | "subtype" | "code">): string {
  const subtype = (inv.subtype ?? "").toUpperCase();
  switch (inv.type) {
    case "FIXED_INCOME":
      return subtype === "TREASURY" ? "Tesouro Direto" : "Renda Fixa";
    case "EQUITY":
      if (subtype === "REAL_ESTATE_FUND" || /^[A-Z]{4}11$/.test(inv.code ?? "")) return "FIIs";
      if (subtype === "ETF") return "ETF";
      return "Ações";
    case "ETF":
      return "ETF";
    case "MUTUAL_FUND":
      return "Fundos";
    case "SECURITY":
      return "Previdência";
    default:
      return "Outros";
  }
}

/**
 * Converte uma posição do banco no formato da carteira.
 * O total (quantidade × preço atual) é sempre o saldo informado pelo banco.
 * Sem valor aplicado nem rendimento informados, o ganho fica marcado como desconhecido.
 */
export function bankToPortfolioItem(inv: SyncedInvestment): PortfolioItem {
  const balance = Number(inv.balance);
  const quantity = inv.quantity && Number(inv.quantity) > 0 ? Number(inv.quantity) : 1;
  const currentPrice = balance / quantity;
  const profit = bankProfit(inv);
  const original = profit !== null ? balance - profit : null;
  return {
    id: `bank-${inv.id}`,
    user_id: inv.user_id,
    asset_name: inv.code || inv.name,
    asset_type: bankAssetType(inv),
    quantity,
    current_price: currentPrice,
    purchase_price: original !== null ? original / quantity : currentPrice,
    purchase_date: (inv.reference_date ?? inv.synced_at ?? inv.created_at).slice(0, 10),
    created_at: inv.created_at,
    updated_at: inv.updated_at,
    origin: "bank",
    issuer: inv.issuer,
    gainKnown: original !== null,
  };
}

export function buildPortfolio(manual: Investment[], bank: SyncedInvestment[]): PortfolioItem[] {
  return [
    ...manual.map((i) => ({ ...i, origin: "manual" as const, gainKnown: true })),
    // Posições zeradas (resgatadas) não entram
    ...bank.filter((i) => Number(i.balance) > 0).map(bankToPortfolioItem),
  ];
}

/** Totais da carteira. O ganho só considera posições com valor aplicado conhecido. */
export function portfolioTotals(items: PortfolioItem[]) {
  const value = (i: PortfolioItem) => i.current_price * i.quantity;
  const cost = (i: PortfolioItem) => i.purchase_price * i.quantity;
  const known = items.filter((i) => i.gainKnown);
  const invested = known.reduce((s, i) => s + cost(i), 0);
  const gain = known.reduce((s, i) => s + value(i) - cost(i), 0);
  return {
    current: items.reduce((s, i) => s + value(i), 0),
    invested,
    gain,
    gainPct: invested > 0 ? (gain / invested) * 100 : 0,
    unknownCount: items.length - known.length,
    unknownValue: items.filter((i) => !i.gainKnown).reduce((s, i) => s + value(i), 0),
  };
}
