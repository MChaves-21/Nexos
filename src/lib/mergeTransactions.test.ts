import { describe, expect, it } from "vitest";
import { buildLedger, mergeTransactions } from "./mergeTransactions";
import type { Transaction } from "@/hooks/useTransactions";
import type { SyncedTransaction } from "@/hooks/useBankConnections";

const manual = (id: string, date: string): Transaction => ({
  id, user_id: "u", type: "expense", description: `Manual ${id}`, category: "Lazer",
  amount: 20, date, created_at: "", updated_at: "",
});

const synced = (id: string, date: string, extra: Partial<SyncedTransaction> = {}) =>
  ({
    id, user_id: "u", bank_connection_id: "c", external_id: id, description: `Banco ${id}`,
    amount: 10, date, type: "expense", original_category: "Shopping", ai_category: null, ai_confidence: null,
    is_reviewed: false, synced_at: "", created_at: "", updated_at: "", bank_account_id: null, source: "pluggy",
    installment_info: null, hash: null, category_source: null, ...extra,
  }) as SyncedTransaction;

describe("mergeTransactions", () => {
  it("combines manual and bank transactions sorted by date desc", () => {
    const result = mergeTransactions([manual("m1", "2026-08-02")], [synced("s1", "2026-08-03"), synced("s2", "2026-08-01")]);
    expect(result.map((t) => [t.id, t.origin])).toEqual([["s1", "bank"], ["m1", "manual"], ["s2", "bank"]]);
  });

  it("skips bank transactions already imported to the manual table", () => {
    const result = mergeTransactions([manual("m1", "2026-08-02")], [synced("s1", "2026-08-02", { is_reviewed: true })]);
    expect(result.map((t) => t.id)).toEqual(["m1"]);
  });

  it("uses the AI/rule category before the bank's original category", () => {
    const [a, b] = mergeTransactions([], [
      synced("s1", "2026-08-02", { ai_category: "Alimentação" }),
      synced("s2", "2026-08-01"),
    ]);
    expect(a.category).toBe("Alimentação");
    // Categoria da Pluggy em inglês é traduzida
    expect(b.category).toBe("Compras");
  });
});

describe("buildLedger", () => {
  it("estorno no cartão abate o gasto em vez de virar renda", () => {
    const refund = synced("r1", "2026-08-05", { type: "income", ai_category: "Compras", bank_account_id: "card" });
    const [t] = mergeTransactions([], [refund], { cardAccountIds: new Set(["card"]) });
    expect(t).toMatchObject({ type: "expense", amount: -10, refund: true, category: "Compras" });
  });

  it("crédito na conta corrente continua sendo entrada", () => {
    const [t] = mergeTransactions([], [synced("r1", "2026-08-05", { type: "income", ai_category: "Salário", bank_account_id: "conta" })], {
      cardAccountIds: new Set(["card"]),
    });
    expect(t).toMatchObject({ type: "income", amount: 10 });
  });

  it("Pix entre contas próprias vira transferência", () => {
    const out = synced("s1", "2026-08-05", { description: "Pix enviado - MURILO CHAVES", amount: 300, bank_account_id: "nubank" });
    const inn = synced("s2", "2026-08-05", { description: "Pix recebido - MURILO CHAVES", amount: 300, type: "income", bank_account_id: "itau" });
    expect(mergeTransactions([], [out, inn]).map((t) => t.category)).toEqual(["Transferência", "Transferência"]);
  });

  it("lançamento manual repetido pelo banco sai da lista e fica em manualDuplicates", () => {
    const m = { ...manual("m1", "2026-08-02"), description: "Netflix", amount: 10, category: "Assinaturas" };
    const s = synced("s1", "2026-08-03", { description: "NETFLIX.COM", amount: 10 });
    const ledger = buildLedger([m], [s]);
    expect(ledger.transactions.map((t) => t.id)).toEqual(["s1"]);
    expect(ledger.manualDuplicates.map((d) => [d.manual.id, d.bank.id])).toEqual([["m1", "s1"]]);
  });
});
