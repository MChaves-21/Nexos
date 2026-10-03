import { describe, expect, it } from "vitest";
import { estimateYield, isInvestmentFlow } from "./yieldEstimate";

describe("estimateYield", () => {
  it("precisa de dois dias de histórico", () => {
    expect(estimateYield([{ date: "2026-10-01", balance: 1000 }], [])).toBeNull();
  });

  it("variação do saldo sem aportes é rendimento", () => {
    const r = estimateYield([{ date: "2026-10-01", balance: 1000 }, { date: "2026-10-31", balance: 1008.5 }], []);
    expect(r).toMatchObject({ value: 8.5, since: "2026-10-01", until: "2026-10-31", netFlows: 0 });
  });

  it("desconta aportes e devolve resgates (não confunde depósito com rendimento)", () => {
    const history = [{ date: "2026-10-01", balance: 1000 }, { date: "2026-10-31", balance: 1505 }];
    const txs = [
      { date: "2026-10-10", amount: 600, type: "expense", description: "Aplicação na caixinha" },
      { date: "2026-10-20", amount: 100, type: "income", description: "Valor recebido de Investimentos" },
      { date: "2026-10-15", amount: 50, type: "expense", description: "Mercado" }, // não é investimento
      { date: "2026-09-30", amount: 999, type: "expense", description: "Aplicação antiga" }, // antes do período
    ];
    expect(estimateYield(history, txs)?.value).toBe(5); // 505 − 600 + 100
  });

  it("reconhece movimentos de investimento pela categoria ou descrição", () => {
    expect(isInvestmentFlow({ date: "", amount: 1, type: "income", description: "Valor recebido de Investimentos" })).toBe(true);
    expect(isInvestmentFlow({ date: "", amount: 1, type: "expense", description: "Qualquer", category: "Investimento" })).toBe(true);
    expect(isInvestmentFlow({ date: "", amount: 1, type: "expense", description: "Uber" })).toBe(false);
  });
});
