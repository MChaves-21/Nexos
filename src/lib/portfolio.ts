// Junta a carteira cadastrada à mão com as posições lidas do banco (Open Finance)
// num único formato, para que totais, gráficos e alocação usem tudo.
import type { Investment } from "@/hooks/useInvestments";
import type { SyncedInvestment } from "@/hooks/useBankConnections";

export interface PortfolioItem extends Investment {
  origin: "manual" | "bank";
  /** Quando veio do banco: instituição/emissor, para exibir */
  issuer?: string | null;
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
 * Sem valor aplicado informado, o preço de compra = preço atual (ganho 0, em vez de inventar).
 */
export function bankToPortfolioItem(inv: SyncedInvestment): PortfolioItem {
  const balance = Number(inv.balance);
  const quantity = inv.quantity && Number(inv.quantity) > 0 ? Number(inv.quantity) : 1;
  const currentPrice = balance / quantity;
  const original = inv.amount_original != null && Number(inv.amount_original) > 0 ? Number(inv.amount_original) : null;
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
  };
}

export function buildPortfolio(manual: Investment[], bank: SyncedInvestment[]): PortfolioItem[] {
  return [
    ...manual.map((i) => ({ ...i, origin: "manual" as const })),
    // Posições zeradas (resgatadas) não entram
    ...bank.filter((i) => Number(i.balance) > 0).map(bankToPortfolioItem),
  ];
}
