import { describe, expect, it } from "vitest";
import { categorizeByRules, extractKeyword } from "./categorization";
import { installmentInfo, mapAccount, mapItemStatus, mapTransaction, shouldImportTransaction, syncFromDate, transactionKind } from "./pluggy-mappers";

describe("categorization", () => {
  it("extracts a learnable keyword", () => {
    expect(extractKeyword("UBER *TRIP HELP.UBER.COM 12/05")).toBe("uber trip help");
    expect(extractKeyword("Loja Exemplo - Parcela 2/5")).toBe("loja exemplo");
    expect(extractKeyword("Compra no débito - Padaria Central")).toBe("padaria central");
  });

  it("prefers more specific default rules", () => {
    expect(categorizeByRules("MERCADO LIVRE *LOJA")?.category).toBe("Compras");
    expect(categorizeByRules("Supermercado Bom Preço")?.category).toBe("Alimentação");
    expect(categorizeByRules("Amazon Prime Canais")?.category).toBe("Assinaturas");
  });

  it("matches short keywords only as whole words", () => {
    expect(categorizeByRules("Pix enviado - Fulano")?.category).toBe("Transferência");
    expect(categorizeByRules("Pixel Store")).toBeNull();
  });

  it("user rules win and flag fromUserRule", () => {
    expect(categorizeByRules("Uber *Trip", [{ keyword: "uber", category: "Lazer" }])).toEqual({ category: "Lazer", fromUserRule: true });
  });
});

describe("pluggy mappers", () => {
  it("uses type DEBIT/CREDIT over the amount sign", () => {
    expect(transactionKind({ id: "1", amount: 50, date: "", type: "DEBIT" }, "CREDIT")).toBe("expense");
    expect(transactionKind({ id: "1", amount: -50, date: "", type: "DEBIT" }, "BANK")).toBe("expense");
    expect(transactionKind({ id: "1", amount: -50, date: "", type: "CREDIT" }, "CREDIT")).toBe("income");
  });

  it("falls back to the sign by account type", () => {
    expect(transactionKind({ id: "1", amount: 50, date: "" }, "CREDIT")).toBe("expense");
    expect(transactionKind({ id: "1", amount: -50, date: "" }, "BANK")).toBe("expense");
    expect(transactionKind({ id: "1", amount: 50, date: "" }, "BANK")).toBe("income");
  });

  it("maps transactions", () => {
    const row = mapTransaction(
      {
        id: "tx1",
        description: " Loja Ficticia ",
        amount: 120.5,
        date: "2026-09-10T03:00:00.000Z",
        type: "DEBIT",
        category: "Shopping",
        creditCardMetadata: { installmentNumber: 3, totalInstallments: 10 },
      },
      "CREDIT",
    );
    expect(row).toEqual({
      external_id: "tx1",
      description: "Loja Ficticia",
      amount: 120.5,
      date: "2026-09-10",
      type: "expense",
      original_category: "Shopping",
      installment_info: "3/10",
      source: "pluggy",
    });
    expect(installmentInfo({ id: "x", amount: 1, date: "", creditCardMetadata: { installmentNumber: 1, totalInstallments: 1 } })).toBeNull();
  });

  it("skips pending transactions", () => {
    expect(shouldImportTransaction({ id: "1", amount: 1, date: "", status: "PENDING" })).toBe(false);
    expect(shouldImportTransaction({ id: "1", amount: 1, date: "", status: "POSTED" })).toBe(true);
  });

  it("maps item status and expired consent", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    expect(mapItemStatus({ id: "i", status: "UPDATED" }, now).status).toBe("connected");
    expect(mapItemStatus({ id: "i", status: "LOGIN_ERROR" }, now).status).toBe("reauth_required");
    expect(mapItemStatus({ id: "i", status: "OUTDATED" }, now).status).toBe("outdated");
    expect(mapItemStatus({ id: "i", status: "UPDATED", consentExpiresAt: "2026-09-01T00:00:00Z" }, now).status).toBe("reauth_required");
  });

  it("computes the sync window", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    expect(syncFromDate(null, now)).toBe("2025-09-30");
    expect(syncFromDate("2026-09-20T08:00:00Z", now)).toBe("2026-09-10");
  });
});

describe("mapAccount", () => {
  it("keeps credit card invoice data", () => {
    const row = mapAccount({
      id: "a1", type: "CREDIT", name: "Nubank", balance: 850,
      creditData: { creditLimit: 5000, availableCreditLimit: 4150, balanceDueDate: "2026-10-08T00:00:00.000Z", balanceCloseDate: "2026-10-01T00:00:00.000Z", minimumPayment: 127.5, brand: "MASTERCARD" },
    });
    expect(row).toMatchObject({ balance_due_date: "2026-10-08", balance_close_date: "2026-10-01", minimum_payment: 127.5, card_brand: "MASTERCARD", credit_limit: 5000 });
    expect(mapAccount({ id: "b", type: "BANK", name: "Conta" })).toMatchObject({ balance_due_date: null, card_brand: null });
  });
});
