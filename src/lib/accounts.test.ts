import { describe, expect, it } from "vitest";
import { accountsNet, accountTitle, amountLabel, cardDebt, creditUsage } from "./accounts";

describe("accounts", () => {
  it("troca o nome jurídico por algo legível", () => {
    expect(accountTitle({ name: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)", type: "BANK", balance: 1256.56 })).toBe("Conta corrente");
    expect(accountTitle({ name: "Conta Corrente", type: "BANK", subtype: "CHECKING_ACCOUNT", balance: 0 })).toBe("Conta corrente");
    expect(accountTitle({ name: "Poupança Itaú", type: "BANK", subtype: "SAVINGS_ACCOUNT", balance: 0 })).toBe("Poupança");
    expect(accountTitle({ name: "gold", type: "CREDIT", balance: 0 })).toBe("Cartão Gold");
    expect(accountTitle({ name: "Cartão ultravioleta", type: "CREDIT", balance: 0 })).toBe("Cartão Ultravioleta");
    expect(accountTitle({ name: "Nu Pagamentos S.A. cartão de crédito", type: "CREDIT", balance: 0 })).toBe("Cartão de crédito");
  });

  it("diz se o valor é saldo ou fatura e calcula o limite usado", () => {
    expect(amountLabel({ name: "x", type: "BANK", balance: 1 })).toBe("Saldo");
    expect(amountLabel({ name: "x", type: "CREDIT", balance: 1 })).toBe("Fatura atual");
    expect(creditUsage({ name: "gold", type: "CREDIT", balance: 0, credit_limit: 5000, available_credit_limit: 4149.5 })).toEqual({ used: 850.5, limit: 5000 });
    expect(creditUsage({ name: "gold", type: "CREDIT", balance: 0, credit_limit: null })).toBeNull();
    expect(creditUsage({ name: "c", type: "BANK", balance: 0, credit_limit: 10, available_credit_limit: 5 })).toBeNull();
  });
});

describe("dívida do cartão", () => {
  it("usa o limite usado quando ele inclui parcelas futuras", () => {
    expect(cardDebt({ name: "gold", type: "CREDIT", balance: 800, credit_limit: 10000, available_credit_limit: 7000 })).toBe(3000);
  });
  it("sem dados de limite, fica a fatura; fatura negativa não é dívida", () => {
    expect(cardDebt({ name: "gold", type: "CREDIT", balance: 800 })).toBe(800);
    expect(cardDebt({ name: "gold", type: "CREDIT", balance: -50 })).toBe(0);
  });
  it("soma contas e cartões", () => {
    expect(accountsNet([
      { name: "c", type: "BANK", balance: 1000 },
      { name: "gold", type: "CREDIT", balance: 200, credit_limit: 1000, available_credit_limit: 500 },
    ])).toEqual({ cash: 1000, debt: 500 });
  });
});
