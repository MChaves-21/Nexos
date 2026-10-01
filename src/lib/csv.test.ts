import { describe, expect, it } from "vitest";
import { csvCell, neutralizeFormula, toCsv } from "./csv";

describe("csv export", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(neutralizeFormula('=HYPERLINK("http://x","clique")')).toBe(`'=HYPERLINK("http://x","clique")`);
    expect(neutralizeFormula("+5511999")).toBe("'+5511999");
    expect(neutralizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeFormula("Mercado")).toBe("Mercado");
  });

  it("escapes quotes and joins rows", () => {
    expect(csvCell('Padaria "Pão Quente"')).toBe('"Padaria ""Pão Quente"""');
    expect(toCsv([["a", 1], ["b", null]])).toBe('"a","1"\n"b",""');
  });
});
