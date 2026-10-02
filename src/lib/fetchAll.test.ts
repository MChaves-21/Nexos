import { describe, expect, it } from "vitest";
import { chunk, fetchAllRows } from "./fetchAll";

describe("fetchAllRows", () => {
  const table = Array.from({ length: 2345 }, (_, i) => i);
  const fakePage = (calls: Array<[number, number]>) => (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: table.slice(from, to + 1), error: null });
  };

  it("busca além das 1.000 primeiras linhas", async () => {
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllRows(fakePage(calls));
    expect(rows).toHaveLength(2345);
    expect(rows[2344]).toBe(2344);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("para na primeira página quando cabe tudo", async () => {
    const calls: Array<[number, number]> = [];
    expect(await fetchAllRows(fakePage(calls), 5000)).toHaveLength(2345);
    expect(calls).toHaveLength(1);
  });

  it("repassa o erro do banco", async () => {
    const boom = { message: "permission denied" };
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: boom }))).rejects.toBe(boom);
  });

  it("divide listas em pedaços", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
