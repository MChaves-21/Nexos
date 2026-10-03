import { describe, expect, it } from "vitest";
import {
  averageMonthlySavings,
  monthForecast,
  monthKeyAgo,
  monthSummary,
  parseLocalDate,
  recurringCharges,
  spendingByWeekday,
  summaryHeadline,
  topExpenseCategories,
  unusualSpending,
  type InsightTransaction,
} from "./insights";

const now = new Date(2026, 8, 20); // 20/09/2026

const tx = (date: string, amount: number, category: string, description = category, type: "income" | "expense" = "expense"): InsightTransaction =>
  ({ date, amount, category, description, type });

describe("helpers", () => {
  it("computes month keys across year boundaries", () => {
    expect(monthKeyAgo(new Date(2026, 0, 15), 1)).toBe("2025-12");
    expect(monthKeyAgo(now, 0)).toBe("2026-09");
  });

  it("parses dates in local time", () => {
    const d = parseLocalDate("2026-09-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 1]);
  });
});

describe("monthSummary / summaryHeadline", () => {
  const txs = [
    tx("2026-09-05", 5000, "Salário", "Salário", "income"),
    tx("2026-09-06", 900, "Alimentação"),
    tx("2026-09-07", 1000, "Transferência"), // ignorada
    tx("2026-08-10", 1000, "Alimentação"),
  ];

  it("ignores transfers and compares with last month", () => {
    const s = monthSummary(txs, now);
    expect(s).toMatchObject({ income: 5000, expense: 900, balance: 4100, spending: 900, invested: 0, saved: 4100, previousSpending: 1000 });
    expect(s.spendingChangePct).toBeCloseTo(-10);
  });

  it("writes a plain-language sentence", () => {
    expect(summaryHeadline(monthSummary(txs, now))).toMatch(/Você gastou R\$\s?900,00 este mês, 10% a menos que no mês passado\. Sobraram R\$\s?4\.100,00\./);
    expect(summaryHeadline(monthSummary([], now))).toBe("Ainda não há movimentações neste mês.");
  });
});

describe("topExpenseCategories", () => {
  it("returns the biggest categories this month", () => {
    const top = topExpenseCategories(
      [tx("2026-09-01", 100, "Lazer"), tx("2026-09-02", 300, "Moradia"), tx("2026-09-03", 50, "Lazer"), tx("2026-08-01", 999, "Saúde")],
      now,
      2,
    );
    expect(top).toEqual([{ category: "Moradia", total: 300 }, { category: "Lazer", total: 150 }]);
  });
});

describe("unusualSpending", () => {
  it("flags categories well above the 3-month average", () => {
    const txs = [
      tx("2026-06-10", 200, "Lazer"), tx("2026-07-10", 200, "Lazer"), tx("2026-08-10", 200, "Lazer"),
      tx("2026-09-10", 500, "Lazer"),
      tx("2026-06-10", 1000, "Moradia"), tx("2026-09-10", 1100, "Moradia"),
    ];
    const alerts = unusualSpending(txs, now);
    expect(alerts.map((a) => a.category)).toEqual(["Lazer"]);
    expect(alerts[0].abovePct).toBeCloseTo(150);
  });

  it("returns nothing without history", () => {
    expect(unusualSpending([tx("2026-09-10", 500, "Lazer")], now)).toEqual([]);
  });
});

describe("recurringCharges", () => {
  it("finds charges repeated with similar amounts", () => {
    const txs = [
      tx("2026-07-05", 55.9, "Assinaturas", "NETFLIX.COM"),
      tx("2026-08-05", 55.9, "Assinaturas", "Netflix.com"),
      tx("2026-09-05", 59.9, "Assinaturas", "NETFLIX.COM"),
      tx("2026-08-10", 30, "Alimentação", "Padaria Central"),
      tx("2026-09-10", 120, "Alimentação", "Padaria Central"), // valor muito diferente
      tx("2026-09-12", 80, "Lazer", "Cinema"),
    ];
    const r = recurringCharges(txs, now);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ category: "Assinaturas", months: 3 });
    expect(r[0].monthlyAmount).toBeCloseTo(57.23, 1);
  });
});

describe("spendingByWeekday", () => {
  it("sums expenses per weekday", () => {
    // 14/09/2026 é segunda-feira
    const r = spendingByWeekday([tx("2026-09-14", 40, "Lazer"), tx("2026-09-14", 10, "Lazer"), tx("2026-09-19", 5, "Lazer")], now);
    expect(r[1]).toEqual({ day: "Segunda", total: 50 });
    expect(r[6]).toEqual({ day: "Sábado", total: 5 });
  });
});

describe("monthForecast", () => {
  it("projects linearly mid-month", () => {
    const f = monthForecast([tx("2026-09-10", 1000, "Lazer")], now); // dia 20 de 30
    expect(f.spentSoFar).toBe(1000);
    expect(f.projected).toBeCloseTo(1500);
  });

  it("uses the past average early in the month", () => {
    const early = new Date(2026, 8, 3);
    const f = monthForecast([tx("2026-09-02", 300, "Lazer"), tx("2026-08-10", 2000, "Lazer"), tx("2026-07-10", 1000, "Lazer")], early);
    expect(f.previousAverage).toBe(1500);
    expect(f.projected).toBe(1500);
  });
});

describe("averageMonthlySavings", () => {
  it("averages complete past months only", () => {
    const txs = [
      tx("2026-08-01", 3000, "Salário", "Salário", "income"), tx("2026-08-02", 2000, "Moradia"),
      tx("2026-07-01", 3000, "Salário", "Salário", "income"), tx("2026-07-02", 2500, "Moradia"),
      tx("2026-09-01", 9999, "Salário", "Salário", "income"), // mês atual não conta
    ];
    expect(averageMonthlySavings(txs, now)).toBe(750);
    expect(averageMonthlySavings([], now)).toBeNull();
  });
});

describe("aportes não são gastos", () => {
  const txs = [
    tx("2026-09-05", 5000, "Salário", "Salário", "income"),
    tx("2026-09-06", 3000, "Moradia"),
    tx("2026-09-07", 1500, "Investimento", "Aplicação RDB"),
    tx("2026-09-08", 200, "Investimento", "Resgate RDB", "income"),
    tx("2026-08-07", 1500, "Investimento", "Aplicação RDB"),
    tx("2026-07-07", 1500, "Investimento", "Aplicação RDB"),
  ];

  it("o resumo separa gasto, investido e o que ficou na conta", () => {
    const s = monthSummary(txs, now);
    expect(s).toMatchObject({ income: 5200, expense: 4500, balance: 700, spending: 3000, invested: 1300, saved: 2000 });
    expect(summaryHeadline(s)).toMatch(/Você gastou R\$\s?3\.000,00 este mês\. Investiu R\$\s?1\.300,00\. Sobraram R\$\s?700,00 na conta\./);
  });

  it("investimento não aparece nas maiores categorias, alertas nem cobranças recorrentes", () => {
    expect(topExpenseCategories(txs, now, 5).map((c) => c.category)).toEqual(["Moradia"]);
    expect(unusualSpending(txs, now).map((a) => a.category)).not.toContain("Investimento");
    expect(recurringCharges(txs, now).map((r) => r.category)).not.toContain("Investimento");
  });

  it("quem investe todo mês aparece guardando dinheiro no simulador", () => {
    const monthly = [1, 2, 3].flatMap((n) => {
      const m = `2026-0${9 - n}`;
      return [tx(`${m}-05`, 5000, "Salário", "Salário", "income"), tx(`${m}-06`, 3500, "Moradia"), tx(`${m}-07`, 1500, "Investimento")];
    });
    expect(averageMonthlySavings(monthly, now)).toBe(1500);
  });

  it("estorno (saída negativa) abate o gasto da categoria", () => {
    const s = monthSummary([tx("2026-09-06", 300, "Compras"), tx("2026-09-07", -100, "Compras")], now);
    expect(s.spending).toBe(200);
  });
});
