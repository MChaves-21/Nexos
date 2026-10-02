import { describe, expect, it } from "vitest";
import { priceChanged, priceSource, roundPrice } from "./prices";

describe("prices", () => {
  it("escolhe a fonte certa para cada ativo", () => {
    expect(priceSource("petr4", "Ações")).toEqual({ kind: "yahoo", symbol: "PETR4.SA", inUsd: false });
    expect(priceSource("KNCR11", "FIIs")).toEqual({ kind: "yahoo", symbol: "KNCR11.SA", inUsd: false });
    expect(priceSource("B3SA3", "Ações")).toEqual({ kind: "yahoo", symbol: "B3SA3.SA", inUsd: false });
    expect(priceSource("AAPL", "Ações")).toEqual({ kind: "yahoo", symbol: "AAPL", inUsd: true });
    expect(priceSource("BTC", "Criptomoedas")).toEqual({ kind: "crypto", coinId: "bitcoin" });
    expect(priceSource("pepe", "Criptomoedas")).toEqual({ kind: "crypto", coinId: "pepe" });
  });

  it("não busca nomes que não são tickers (nem monta URLs com texto livre)", () => {
    expect(priceSource("CDB Banco Fictício 2027", "Renda Fixa")).toBeNull();
    expect(priceSource("../../admin?x=1", "Ações")).toBeNull();
    expect(priceSource("", "Ações")).toBeNull();
  });

  it("guarda frações de centavo e ignora variações mínimas", () => {
    expect(roundPrice(0.000123456789)).toBe(0.00012346);
    expect(priceChanged(36, 36.001)).toBe(false);
    expect(priceChanged(36, 36.5)).toBe(true);
    expect(priceChanged(0.00012, 0.00013)).toBe(true);
  });
});
