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
    currentYear: 2025,
  });

  it("sums deductible health and education expenses of the year only", () => {
    expect(s.deductible.health.total).toBe(500);
    expect(s.deductible.health.items.map((i) => i.description)).toEqual(["Consulta", "Exame"]);
    expect(s.deductible.education.total).toBe(1200);
  });

  it("groups income by category, ignoring transfers", () => {
    expect(s.income).toEqual([
      { category: "Salário", total: 10000, taxable: true },
      { category: "Freelance", total: 800, taxable: true },
    ]);
    expect(s.incomeTotal).toBe(10800);
    expect(s.taxableIncomeTotal).toBe(10800);
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


describe("o que a Receita aceita", () => {
  const s = buildTaxSummary({
    year: 2025,
    currentYear: 2026,
    transactions: [
      tx("expense", "Saúde", 300, "2025-03-10", "Consulta Dr. Silva"),
      tx("expense", "Saúde", 80, "2025-03-11", "DROGASIL 123"),
      tx("expense", "Saúde", 120, "2025-03-12", "Smart Fit mensalidade"),
      tx("expense", "Saúde", 100, "2025-03-13", "DUMBBELLS*ACADEMIA*VILA*CONSULTA*CLINICA*ODONTOLOGICA*LTDA"),
      tx("expense", "Educação", 2000, "2025-02-05", "Faculdade X"),
      tx("expense", "Educação", 50, "2025-02-06", "Udemy curso React"),
      tx("expense", "Educação", 70, "2025-02-07", "Livraria Cultura"),
      tx("income", "Outros", 200, "2025-05-05", "Venda usada"),
      tx("income", "Salário", 5000, "2025-05-05"),
    ],
    manualInvestments: [],
    bankInvestments: [{ name: "CDB", code: null, type: "FIXED_INCOME", balance: 1100, amount_original: 1000, issuer: "Nubank" }],
  });

  it("farmácia, academia, cursos livres e livros não são dedutíveis", () => {
    expect(s.deductible.health.items.map((i) => i.description)).toEqual(["Consulta Dr. Silva", "DUMBBELLS*ACADEMIA*VILA*CONSULTA*CLINICA*ODONTOLOGICA*LTDA"]);
    expect(s.deductible.education.items.map((i) => i.description)).toEqual(["Faculdade X"]);
    expect(s.notDeductible.total).toBe(320);
    expect(s.deductible.education.cap).toBe(3561.5);
  });

  it("separa rendimentos tributáveis dos que precisam ser conferidos", () => {
    expect(s.income).toEqual([
      { category: "Salário", total: 5000, taxable: true },
      { category: "Outros", total: 200, taxable: false },
    ]);
    expect(s.taxableIncomeTotal).toBe(5000);
  });

  it("em ano já encerrado, não usa a posição de hoje do banco como se fosse a de 31/12", () => {
    expect(s.assets).toEqual([]);
    expect(s.bankAssetsOmitted).toBe(1);
  });
});
