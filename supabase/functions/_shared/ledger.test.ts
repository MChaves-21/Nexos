import { describe, expect, it } from "vitest";
import { categorizeByRules, categorizeIncoming, extractKeyword, mapSourceCategory, resolveCategory } from "./categorization";
import { findManualDuplicates, findOwnTransfers, findReversals, isCardRefund, isRefundDescription, type LedgerRow } from "./ledger";
import { isSpending } from "./flows";

describe("Pix não é transferência por padrão", () => {
  it("Pix e TED para outras pessoas ficam para as regras normais ou para a IA", () => {
    expect(categorizeByRules("Transferência enviada pelo Pix - IMOBILIARIA SOL - aluguel")?.category).toBe("Moradia");
    expect(categorizeByRules("Transferência recebida pelo Pix - EMPRESA XYZ LTDA")).toBeNull();
    expect(categorizeByRules("Pix enviado - Supermercado do Zé")?.category).toBe("Alimentação");
    expect(categorizeByRules("TED recebida - salario")?.category).toBe("Salário");
  });

  it("pagamento da fatura continua sendo transferência", () => {
    expect(categorizeByRules("Pagamento de fatura")?.category).toBe("Transferência");
    expect(categorizeByRules("Pagamento recebido")?.category).toBe("Transferência");
  });

  it("a categoria da Pluggy 'mesma pessoa' marca transferência, mas a regra da pessoa vence", () => {
    expect(categorizeIncoming("Transferência enviada - MURILO", "Same person transfer - PIX")?.category).toBe("Transferência");
    expect(categorizeIncoming("Transferência enviada - MURILO", "Transfer - PIX")).toBeNull();
    expect(categorizeIncoming("Pix - MURILO", "Same person transfer - PIX", [{ keyword: "murilo", category: "Lazer" }])?.category).toBe("Lazer");
  });
});

describe("regras aprendidas", () => {
  it("aprende o nome de quem recebeu o Pix, não o meio de pagamento", () => {
    expect(extractKeyword("Transferência enviada pelo Pix - FULANO DE TAL")).toBe("fulano tal");
    expect(extractKeyword("Pix recebido de LOJA BOA")).toBe("loja boa");
    expect(extractKeyword("Transferência enviada pelo Pix")).toBe("");
  });

  it("palavra-chave sem as palavras de ligação ainda casa com a descrição", () => {
    const keyword = extractKeyword("Loja do João 12/05");
    expect(keyword).toBe("loja joao");
    expect(categorizeByRules("LOJA DO JOAO CENTRO", [{ keyword, category: "Compras" }])).toEqual({ category: "Compras", fromUserRule: true });
    expect(categorizeByRules("JOAO LOJA", [{ keyword, category: "Compras" }])).toBeNull();
  });
});

describe("categoria da fonte", () => {
  it("traduz as categorias da Pluggy e da fatura do Nubank", () => {
    expect(mapSourceCategory("Groceries")).toBe("Alimentação");
    expect(mapSourceCategory("Pharmacy")).toBe("Saúde");
    expect(mapSourceCategory("Credit card payment")).toBe("Transferência");
    expect(mapSourceCategory("Gas stations")).toBe("Transporte");
    expect(mapSourceCategory("restaurante")).toBe("Alimentação");
    expect(mapSourceCategory("Transfer - PIX")).toBeNull();
    expect(resolveCategory(null, "Transfer - PIX")).toBe("Outros");
    expect(resolveCategory("Lazer", "Groceries")).toBe("Lazer");
  });
});

const row = (id: string, type: "income" | "expense", amount: number, date: string, description: string, accountKey: string | null, category = "Outros", locked = false): LedgerRow =>
  ({ id, type, amount, date, description, accountKey, category, locked });

describe("transferências entre contas próprias", () => {
  it("junta saída e entrada do mesmo valor em contas diferentes, com o nome em comum", () => {
    const rows = [
      row("e1", "expense", 500, "2026-09-10", "Transferência enviada pelo Pix - MURILO CHAVES", "nubank"),
      row("i1", "income", 500, "2026-09-11", "Pix recebido - Murilo Chaves", "itau"),
    ];
    expect([...findOwnTransfers(rows)].sort()).toEqual(["e1", "i1"]);
  });

  it("não junta Pix pago a uma pessoa com outro recebido de outra pessoa", () => {
    const rows = [
      row("e1", "expense", 50, "2026-09-10", "Pix enviado - Ana Souza", "nubank"),
      row("i1", "income", 50, "2026-09-10", "Pix recebido - Bruno Lima", "itau"),
    ];
    expect(findOwnTransfers(rows).size).toBe(0);
  });

  it("não junta na mesma conta, com mais de 2 dias, valor diferente ou categoria escolhida pela pessoa", () => {
    expect(findOwnTransfers([row("e", "expense", 10, "2026-09-10", "Pix MURILO", "a"), row("i", "income", 10, "2026-09-10", "Pix MURILO", "a")]).size).toBe(0);
    expect(findOwnTransfers([row("e", "expense", 10, "2026-09-10", "Pix MURILO", "a"), row("i", "income", 10, "2026-09-13", "Pix MURILO", "b")]).size).toBe(0);
    expect(findOwnTransfers([row("e", "expense", 10, "2026-09-10", "Pix MURILO", "a"), row("i", "income", 10.01, "2026-09-10", "Pix MURILO", "b")]).size).toBe(0);
    expect(findOwnTransfers([row("e", "expense", 10, "2026-09-10", "Pix MURILO", "a", "Lazer", true), row("i", "income", 10, "2026-09-10", "Pix MURILO", "b")]).size).toBe(0);
  });

  it("o outro lado de um pagamento de fatura vira transferência mesmo sem palavra em comum", () => {
    const rows = [
      row("e1", "expense", 1234.56, "2026-09-10", "Pagamento efetuado - NU PAGAMENTOS", "conta"),
      row("i1", "income", 1234.56, "2026-09-10", "Pagamento recebido", "cartao", "Transferência"),
    ];
    expect(findOwnTransfers(rows).has("e1")).toBe(true);
  });

  it("estorno é crédito no cartão que não é pagamento", () => {
    expect(isCardRefund({ type: "income", category: "Compras" }, true)).toBe(true);
    expect(isCardRefund({ type: "income", category: "Transferência" }, true)).toBe(false);
    expect(isCardRefund({ type: "income", category: "Salário" }, false)).toBe(false);
  });
});

describe("lançamento manual repetido pelo banco", () => {
  it("acha o par com mesmo valor, até 3 dias e palavra em comum", () => {
    const manual = [row("m1", "expense", 89.9, "2026-09-10", "Farmácia Drogasil", null), row("m2", "expense", 10, "2026-09-10", "Café", null)];
    const bank = [row("b1", "expense", 89.9, "2026-09-12", "DROGASIL 123", "c"), row("b2", "expense", 10, "2026-09-10", "PADARIA X", "c")];
    expect([...findManualDuplicates(manual, bank)]).toEqual([["m1", "b1"]]);
  });
});

describe("gasto x aporte", () => {
  it("aporte e transferência não são gasto de consumo", () => {
    expect(isSpending("Investimento")).toBe(false);
    expect(isSpending("Transferência")).toBe(false);
    expect(isSpending("Moradia")).toBe(true);
  });
});

describe("reembolso total", () => {
  it("corrida cancelada: o Pix e o reembolso do mesmo valor se anulam", () => {
    const rows = [
      row("e1", "expense", 6.7, "2026-10-03", "Transferência enviada pelo Pix|99 TECNOLOGIA LTDA", "nubank", "Transporte"),
      row("r1", "income", 6.7, "2026-10-03", "Reembolso recebido pelo Pix|99 TECNOLOGIA LTDA", "nubank", "Transporte"),
      row("e2", "expense", 6.7, "2026-10-03", "Transferência enviada pelo Pix|PADARIA", "nubank", "Alimentação"),
    ];
    expect([...findReversals(rows)].sort()).toEqual(["e1", "r1"]);
  });

  it("não junta valor diferente, outra loja, outra conta, reembolso antes da compra ou entrada comum", () => {
    const e = row("e", "expense", 50, "2026-10-01", "Pix enviado - LOJA ALFA", "nubank");
    expect(findReversals([e, row("r", "income", 30, "2026-10-02", "Reembolso LOJA ALFA", "nubank")]).size).toBe(0);
    expect(findReversals([e, row("r", "income", 50, "2026-10-02", "Reembolso LOJA BETA", "nubank")]).size).toBe(0);
    expect(findReversals([e, row("r", "income", 50, "2026-10-02", "Reembolso LOJA ALFA", "itau")]).size).toBe(0);
    expect(findReversals([e, row("r", "income", 50, "2026-09-30", "Reembolso LOJA ALFA", "nubank")]).size).toBe(0);
    expect(findReversals([e, row("r", "income", 50, "2026-10-02", "Pix recebido - LOJA ALFA", "nubank")]).size).toBe(0);
    expect(findReversals([e, row("r", "income", 50, "2026-11-15", "Reembolso LOJA ALFA", "nubank")]).size).toBe(0);
  });

  it("reconhece reembolso, estorno e devolução na descrição", () => {
    expect(isRefundDescription("Reembolso recebido pelo Pix")).toBe(true);
    expect(isRefundDescription("Estorno de compra")).toBe(true);
    expect(isRefundDescription("Devolução Mercado Livre")).toBe(true);
    expect(isRefundDescription("Transferência recebida")).toBe(false);
  });
});
