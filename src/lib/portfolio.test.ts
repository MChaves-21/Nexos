import { describe, expect, it } from "vitest";
import { bankAssetType, buildPortfolio } from "./portfolio";
import type { SyncedInvestment } from "@/hooks/useBankConnections";
import type { Investment } from "@/hooks/useInvestments";

const bank = (extra: Partial<SyncedInvestment>): SyncedInvestment =>
  ({
    id: "b1", user_id: "u", bank_connection_id: "c", external_id: "x", name: "Banco do Brasil ON", code: "BBAS3",
    type: "EQUITY", subtype: null, balance: 2644.8, amount_original: null, amount_profit: null, quantity: 100,
    unit_value: 26.448, rate: null, rate_type: null, issuer: null, status: "ACTIVE", due_date: null,
    reference_date: "2026-09-30", currency_code: "BRL", synced_at: "2026-10-01T10:00:00Z", created_at: "2026-10-01T10:00:00Z",
    updated_at: "", ...extra,
  }) as SyncedInvestment;

const manual: Investment = {
  id: "m1", user_id: "u", asset_name: "PETR4", asset_type: "Ações", quantity: 10, purchase_price: 30,
  current_price: 36, purchase_date: "2025-01-10", created_at: "", updated_at: "",
};

describe("bankAssetType", () => {
  it("maps Pluggy types to portfolio types", () => {
    expect(bankAssetType({ type: "EQUITY", subtype: null, code: "WEGE3" })).toBe("Ações");
    expect(bankAssetType({ type: "EQUITY", subtype: null, code: "HGLG11" })).toBe("FIIs");
    expect(bankAssetType({ type: "EQUITY", subtype: "REAL_ESTATE_FUND", code: null })).toBe("FIIs");
    expect(bankAssetType({ type: "FIXED_INCOME", subtype: "TREASURY", code: null })).toBe("Tesouro Direto");
    expect(bankAssetType({ type: "FIXED_INCOME", subtype: "CDB", code: null })).toBe("Renda Fixa");
    expect(bankAssetType({ type: "MUTUAL_FUND", subtype: null, code: null })).toBe("Fundos");
    expect(bankAssetType({ type: "COE", subtype: null, code: null })).toBe("Outros");
  });
});

describe("buildPortfolio", () => {
  it("merges manual and bank positions keeping the bank balance as total", () => {
    const items = buildPortfolio([manual], [bank({})]);
    expect(items.map((i) => [i.asset_name, i.origin])).toEqual([["PETR4", "manual"], ["BBAS3", "bank"]]);
    const b = items[1];
    expect(b.quantity * b.current_price).toBeCloseTo(2644.8);
    expect(b.purchase_price).toBeCloseTo(b.current_price); // sem valor aplicado: ganho 0
    expect(b.purchase_date).toBe("2026-09-30");
  });

  it("uses the invested amount when the bank reports it", () => {
    const [b] = buildPortfolio([], [bank({ code: null, name: "CDB Banco X", type: "FIXED_INCOME", quantity: null, balance: 1100, amount_original: 1000 })]);
    expect(b).toMatchObject({ asset_name: "CDB Banco X", asset_type: "Renda Fixa", quantity: 1, current_price: 1100, purchase_price: 1000 });
  });

  it("skips positions with zero balance", () => {
    expect(buildPortfolio([], [bank({ balance: 0 })])).toEqual([]);
  });
});
