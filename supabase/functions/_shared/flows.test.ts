import { describe, expect, it } from "vitest";
import { changesNetWorth, countsInSummary } from "./flows";

describe("fluxos do mês", () => {
  it("investimento entra no resumo dos dois lados, como no extrato; transferência fica fora", () => {
    expect(countsInSummary("Investimento")).toBe(true);
    expect(countsInSummary("Transferência")).toBe(false);
    expect(countsInSummary("Alimentação")).toBe(true);
    expect(countsInSummary(null)).toBe(true);
  });

  it("aporte e transferência não mudam o patrimônio", () => {
    expect(changesNetWorth("Investimento")).toBe(false);
    expect(changesNetWorth("Transferência")).toBe(false);
    expect(changesNetWorth("Mercado")).toBe(true);
  });
});
