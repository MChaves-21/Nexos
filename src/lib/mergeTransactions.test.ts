import { describe, expect, it } from "vitest";
import { mergeTransactions } from "./mergeTransactions";
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
    expect(b.category).toBe("Shopping");
  });
});
