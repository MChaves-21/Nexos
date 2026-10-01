import { describe, expect, it } from "vitest";
import { compareWithBenchmarks } from "./benchmarks";

const now = new Date(2026, 8, 30);

describe("compareWithBenchmarks", () => {
  it("compares a one-year position with CDI and inflation", () => {
    const r = compareWithBenchmarks([{ invested: 1000, current: 1120, purchaseDate: "2025-09-30" }], { cdi: 10, ipca: 5 }, now)!;
    expect(r.years).toBeCloseTo(1, 1);
    expect(r.returnPct).toBeCloseTo(12);
    expect(r.cdiPct).toBeCloseTo(10, 0);
    expect(r.ipcaPct).toBeCloseTo(5, 0);
    expect(r.pctOfCdi).toBeCloseTo(120, -1);
    expect(r.beatsInflation).toBe(true);
  });

  it("weights the holding period by amount invested", () => {
    const r = compareWithBenchmarks(
      [
        { invested: 3000, current: 3000, purchaseDate: "2024-09-30" }, // 2 anos
        { invested: 1000, current: 1000, purchaseDate: "2026-09-30" }, // 0 anos
      ],
      { cdi: 10, ipca: 5 },
      now,
    )!;
    expect(r.years).toBeCloseTo(1.5, 1);
    expect(r.beatsInflation).toBe(false);
  });

  it("returns null without invested amount", () => {
    expect(compareWithBenchmarks([], { cdi: 10, ipca: 5 }, now)).toBeNull();
  });
});
