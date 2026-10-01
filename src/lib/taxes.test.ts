import { describe, expect, it } from "vitest";
import { buildTaxSummary, type TaxTx } from "./taxes";

const tx = (type: TaxTx["type"], category: string, amount: number, date: string, description = category): TaxTx =>
  ({ type, category, amount, date, description });

describe("buildTaxSummary", () => {
  const s = buildTaxSummary({
    year: 2025,
    transactions: [
      tx("expense", "Saúde", 300, "2025-03-10", "Consulta"),
      tx("expense", "Saúde", 200, "2025-08-01", "Exame"),
      tx("expense", "Saúde", 999, "2024-12-31", "Ano anterior"),
      tx("expense", "Educação", 1200, "2025-02-05", "Faculdade"),
      tx("expense", "Lazer", 50, "2025-05-05"),
      tx("income", "Salário", 5000, "2025-01-05"),
      tx("income", "Salário", 5000, "2025-02-05"),
      tx("income", "Freelance", 800, "2025-04-10"),
      tx("income", "Transferência", 3000, "2025-04-11"),
    ],
    manualInvestments: [
      { asset_name: "PETR4", asset_type: "Ações", quantity: 100, purchase_price: 30, purchase_date: "2025-03-10" },
      { asset_name: "Comprado depois", asset_type: "Ações", quantity: 1, purchase_price: 10, purchase_date: "2026-01-02" },
    ],
    bankInvestments: [
      { name: "CDB", code: null, type: "FIXED_INCOME", balance: 1100, amount_original: 1000, issuer: "Nubank" },
      { name: "Banco do Brasil ON", code: "BBAS3", type: "EQUITY", balance: 2644.8, amount_original: null, issuer: null },
      { name: "Resgatado", code: null, type: "FIXED_INCOME", balance: 0, amount_original: 500, issuer: null },
    ],
  });

  it("sums deductible health and education expenses of the year only", () => {
    expect(s.deductible.health.total).toBe(500);
    expect(s.deductible.health.items.map((i) => i.description)).toEqual(["Consulta", "Exame"]);
    expect(s.deductible.education.total).toBe(1200);
  });

  it("groups income by category, ignoring transfers", () => {
    expect(s.income).toEqual([{ category: "Salário", total: 10000 }, { category: "Freelance", total: 800 }]);
    expect(s.incomeTotal).toBe(10800);
  });

  it("lists assets at acquisition cost, flagging estimates", () => {
    expect(s.assets).toEqual([
      { name: "PETR4", type: "Ações", value: 3000, source: "manual", estimated: false },
      { name: "CDB · Nubank", type: "FIXED_INCOME", value: 1000, source: "bank", estimated: false },
      { name: "BBAS3", type: "EQUITY", value: 2644.8, source: "bank", estimated: true },
    ]);
    expect(s.assetsTotal).toBeCloseTo(6644.8);
  });
});
