import { describe, expect, it } from "vitest";
import { fixedIncomeTaxRate, futureValue, inTodaysMoney, ipcaPlus, monthlyRateFromAnnual, project, requiredMonthlyContribution } from "./simulation";

describe("simulador", () => {
  it("converte taxa anual efetiva em mensal equivalente (não divide por 12)", () => {
    expect(monthlyRateFromAnnual(12)).toBeCloseTo(0.9489, 4);
    // 12 meses na taxa mensal equivalente devolvem a taxa anual
    expect(futureValue(1000, 0, 15, 12)).toBeCloseTo(1150, 6);
  });

  it("R$ 1.000/mês a 15% a.a. por 20 anos dá ~R$ 1,31 mi (dividindo por 12 dava ~R$ 1,50 mi)", () => {
    expect(futureValue(0, 1000, 15, 240)).toBeCloseTo(1311707, -1);
  });

  it("aporte necessário é o inverso do valor futuro", () => {
    const pmt = requiredMonthlyContribution(5000, 100000, 10, 60);
    expect(futureValue(5000, pmt, 10, 60)).toBeCloseTo(100000, 4);
    expect(requiredMonthlyContribution(200000, 100000, 10, 60)).toBe(0);
    expect(requiredMonthlyContribution(0, 1200, 0, 12)).toBe(100);
  });

  it("IPCA + X é composto", () => {
    expect(ipcaPlus(5, 6)).toBeCloseTo(11.3, 6);
  });

  it("desconta inflação e IR da tabela regressiva", () => {
    expect(inTodaysMoney(1100, 10, 12)).toBeCloseTo(1000, 6);
    expect([fixedIncomeTaxRate(180), fixedIncomeTaxRate(181), fixedIncomeTaxRate(500), fixedIncomeTaxRate(721)]).toEqual([22.5, 20, 17.5, 15]);
    const r = project(10000, 0, 10, 24, { inflationPct: 5, taxed: true });
    expect(r.earnings).toBeCloseTo(2100, 6);
    expect(r.incomeTax).toBeCloseTo(2100 * 0.15, 6);
    expect(r.netValue).toBeCloseTo(12100 - 315, 6);
    expect(project(10000, 0, 10, 24, { inflationPct: 5, taxed: false }).incomeTax).toBe(0);
  });
});
