import { describe, expect, it } from "vitest";
import { clearPendingInvite, inviteLink, isInviteToken, memberHealth, readPendingInvite, savePendingInvite, type MemberOverview } from "./family";

const now = new Date("2026-10-02T12:00:00Z");
const base: MemberOverview = {
  user_id: "u", display_name: "Ana", role: "member", connections: 1, pluggy_connections: 1,
  last_sync_at: "2026-10-02T09:00:00Z", problem_connections: 0, reauth_connections: 0, next_consent_expiry: "2027-09-30T00:00:00Z", has_own_pluggy: true,
};

describe("family helpers", () => {
  it("builds and validates invite links", () => {
    const token = "a".repeat(64);
    expect(inviteLink("https://nexos.app/", token)).toBe(`https://nexos.app/convite/${token}`);
    expect(isInviteToken(token)).toBe(true);
    expect(isInviteToken("abc")).toBe(false);
    expect(isInviteToken("<script>")).toBe(false);
  });

  it("summarizes member status from the worst problem down", () => {
    expect(memberHealth(base, now)).toEqual({ level: "ok", message: "Tudo certo." });
    expect(memberHealth({ ...base, reauth_connections: 1 }, now).level).toBe("problem");
    expect(memberHealth({ ...base, problem_connections: 1 }, now).message).toMatch(/erro/);
    expect(memberHealth({ ...base, connections: 0, pluggy_connections: 0 }, now).level).toBe("no-bank");
    expect(memberHealth({ ...base, next_consent_expiry: "2026-10-12T12:00:00Z" }, now)).toEqual({
      level: "attention",
      message: "O consentimento do banco vence em 10 dias.",
    });
    expect(memberHealth({ ...base, last_sync_at: "2026-09-29T12:00:00Z" }, now).message).toMatch(/2 dias/);
  });

  it("keeps a pending invite across tabs for 7 days", () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    const token = "b".repeat(64);
    const t0 = now.getTime();
    savePendingInvite(token, t0, store);
    expect(readPendingInvite(t0 + 6 * 86_400_000, store)).toBe(token);
    expect(readPendingInvite(t0 + 8 * 86_400_000, store)).toBeNull();
    expect(data.size).toBe(0);
    savePendingInvite(token, t0, store);
    clearPendingInvite(store);
    expect(readPendingInvite(t0, store)).toBeNull();
    data.set("nexos:pending-invite", "lixo");
    expect(readPendingInvite(t0, store)).toBeNull();
    data.set("nexos:pending-invite", JSON.stringify({ token: "<script>", at: t0 }));
    expect(readPendingInvite(t0, store)).toBeNull();
  });
});
