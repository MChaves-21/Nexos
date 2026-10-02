import { describe, expect, it } from "vitest";
import { formatUnitPrice } from "./utils";

describe("formatUnitPrice", () => {
  it("mostra centavos normais e frações pequenas sem virar R$ 0,00", () => {
    expect(formatUnitPrice(36.5).replace(/\s/g, " ")).toBe("R$ 36,50");
    expect(formatUnitPrice(0.00008123).replace(/\s/g, " ")).toBe("R$ 0,00008123");
    expect(formatUnitPrice(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});

import { containsPattern, isInternalPath } from "./utils";

describe("containsPattern", () => {
  it("escapa curingas para a regra casar só com o texto digitado", () => {
    expect(containsPattern("uber")).toBe("%uber%");
    expect(containsPattern("50%")).toBe("%50\\%%");
    expect(containsPattern("pix_joao")).toBe("%pix\\_joao%");
    expect(containsPattern("a*b")).toBe("%ab%");
  });
});

describe("isInternalPath", () => {
  it("aceita só rotas do próprio app", () => {
    expect(isInternalPath("/bills")).toBe(true);
    expect(isInternalPath("/open-finance?x=1")).toBe(true);
    expect(isInternalPath("//evil.example")).toBe(false);
    expect(isInternalPath("/\\evil.example")).toBe(false);
    expect(isInternalPath("https://evil.example")).toBe(false);
    expect(isInternalPath("javascript:alert(1)")).toBe(false);
    expect(isInternalPath(null)).toBe(false);
  });
});
