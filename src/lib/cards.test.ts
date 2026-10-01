import { describe, expect, it } from "vitest";
import { limitUsage, projectInstallments, type InstallmentTx } from "./cards";

const tx = (date: string, description: string, installment: string | null, amount = 100, cardKey = "nu"): InstallmentTx =>
  ({ date, description, installment_info: installment, amount, type: "expense", cardKey });

describe("projectInstallments", () => {
  it("projects the remaining installments into the next months", () => {
    const months = projectInstallments([tx("2026-10-03", "Loja X - Parcela 2/5", "2/5", 200)], "2026-10", 4);
    expect(months.map((m) => [m.period, m.total])).toEqual([["2026-11", 200], ["2026-12", 200], ["2027-01", 200], ["2027-02", 0]]);
    expect(months[0].items[0]).toEqual({ description: "Loja X", installment: "3/5", amount: 200, cardKey: "nu" });
    expect(months[2].items[0].installment).toBe("5/5");
  });

  it("does not double count when the bank sends one transaction per installment", () => {
    const months = projectInstallments(
      [tx("2026-09-03", "LOJA X 1/4", "1/4"), tx("2026-10-03", "Loja X - Parcela 2/4", "2/4")],
      "2026-10",
      3,
    );
    expect(months.map((m) => m.total)).toEqual([100, 100, 0]);
  });

  it("ignores finished purchases, income and plain purchases; keeps different cards apart", () => {
    const months = projectInstallments(
      [
        tx("2026-10-03", "Acabou 3/3", "3/3"),
        tx("2026-10-03", "Mercado", null),
        { ...tx("2026-10-03", "Estorno 1/2", "1/2"), type: "income" },
        tx("2026-10-05", "Celular 1/2", "1/2", 300, "nu"),
        tx("2026-10-05", "Celular 1/2", "1/2", 300, "inter"),
      ],
      "2026-10",
      1,
    );
    expect(months[0].total).toBe(600);
  });
});

describe("limitUsage", () => {
  it("computes the used share of the limit", () => {
    expect(limitUsage(5000, 4150)).toBeCloseTo(17);
    expect(limitUsage(null, 100)).toBeNull();
    expect(limitUsage(1000, 1200)).toBe(0);
  });
});
