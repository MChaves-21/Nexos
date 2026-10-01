import { describe, expect, it } from "vitest";
import { isDeletionConfirmed, USER_TABLES_DELETE_ORDER } from "./user-data";

describe("user data (LGPD)", () => {
  it("requires typing EXCLUIR to delete the account", () => {
    expect(isDeletionConfirmed({ confirm: "EXCLUIR" })).toBe(true);
    expect(isDeletionConfirmed({ confirm: " excluir " })).toBe(true);
    expect(isDeletionConfirmed({ confirm: "sim" })).toBe(false);
    expect(isDeletionConfirmed({})).toBe(false);
    expect(isDeletionConfirmed(null)).toBe(false);
  });

  it("deletes child tables before their parents", () => {
    const pos = (t: string) => USER_TABLES_DELETE_ORDER.indexOf(t as never);
    expect(pos("bill_payments")).toBeLessThan(pos("bills"));
    expect(pos("synced_transactions")).toBeLessThan(pos("bank_accounts"));
    expect(pos("bank_accounts")).toBeLessThan(pos("bank_connections"));
  });
});
