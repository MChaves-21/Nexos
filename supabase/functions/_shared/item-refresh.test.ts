import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshItem } from "./item-refresh";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("refreshItem", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pede a atualização e espera a Pluggy terminar", async () => {
    const calls: string[] = [];
    const statuses = ["UPDATING", "UPDATING", "UPDATED"];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
      if (init?.method === "PATCH") return json({ id: "i", status: "UPDATING" });
      return json({ id: "i", status: statuses.shift(), executionStatus: "SUCCESS" });
    }));
    await expect(refreshItem("k", "i", { pollMs: 1 })).resolves.toBe("updated");
    expect(calls).toEqual(["PATCH /items/i", "GET /items/i", "GET /items/i", "GET /items/i"]);
  });

  it("não trava a sincronização se a Pluggy recusar ou demorar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "limit" }, 429)));
    await expect(refreshItem("k", "i", { pollMs: 1 })).resolves.toBe("not-allowed");

    vi.stubGlobal("fetch", vi.fn(async () => json({ id: "i", status: "UPDATING" })));
    await expect(refreshItem("k", "i", { pollMs: 1, timeoutMs: 10 })).resolves.toBe("still-updating");
  });

  it("erro do servidor da Pluggy continua sendo erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    await expect(refreshItem("k", "i", { pollMs: 1 })).rejects.toThrow();
  });
});
