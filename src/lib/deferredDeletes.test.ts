import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeferredDeletes } from "./deferredDeletes";

describe("DeferredDeletes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("apagar dois itens seguidos apaga os dois (antes o primeiro era esquecido)", async () => {
    const deleted: string[] = [];
    const d = new DeferredDeletes<{ id: string }>(async (i) => void deleted.push(i.id));
    d.schedule({ id: "a" });
    vi.advanceTimersByTime(2000);
    d.schedule({ id: "b" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(deleted.sort()).toEqual(["a", "b"]);
  });

  it("desfazer devolve o item certo e não apaga", async () => {
    const deleted: string[] = [];
    const d = new DeferredDeletes<{ id: string; name: string }>(async (i) => void deleted.push(i.id));
    d.schedule({ id: "a", name: "Mercado" });
    d.schedule({ id: "b", name: "Aluguel" });
    expect(d.cancel("a")).toEqual({ id: "a", name: "Mercado" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(deleted).toEqual(["b"]);
    expect(d.cancel("a")).toBeNull();
  });

  it("flushAll apaga na hora o que estava esperando", async () => {
    const deleted: string[] = [];
    const d = new DeferredDeletes<{ id: string }>(async (i) => void deleted.push(i.id));
    d.schedule({ id: "a" });
    d.schedule({ id: "b" });
    await d.flushAll();
    expect(deleted.sort()).toEqual(["a", "b"]);
    expect(d.size).toBe(0);
  });
});
