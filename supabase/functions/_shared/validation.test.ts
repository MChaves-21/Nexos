import { describe, expect, it } from "vitest";
import {
  assertItemOwnership,
  errorStatus,
  isUuid,
  MAX_CATEGORIZE_ITEMS,
  parseCategorizeInput,
  parseItemId,
  publicErrorMessage,
  PublicError,
  requireUuid,
} from "./validation";

const ID = "0f1e2d3c-4b5a-4968-8776-655443322110";

describe("ids", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid("1; drop table x")).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(requireUuid(ID, "connectionId")).toBe(ID);
    expect(() => requireUuid("../etc/passwd", "connectionId")).toThrow(PublicError);
  });

  it("trims pasted item ids", () => {
    expect(parseItemId(`  ${ID}\n`)).toBe(ID);
    expect(() => parseItemId("abc")).toThrow(/Item ID inválido/);
  });
});

describe("parseCategorizeInput", () => {
  it("returns an empty list when nothing is sent", () => {
    expect(parseCategorizeInput({})).toEqual([]);
    expect(parseCategorizeInput(null)).toEqual([]);
  });

  it("validates items and truncates long descriptions", () => {
    const [t] = parseCategorizeInput({ transactions: [{ id: ID, description: "x".repeat(1000) }] });
    expect(t.description).toHaveLength(300);
    expect(() => parseCategorizeInput({ transactions: [{ id: "nope", description: "a" }] })).toThrow(/Transação 1 inválida/);
    expect(() => parseCategorizeInput({ transactions: "a" })).toThrow(/lista/);
  });

  it("limits the batch size (AI cost)", () => {
    const many = Array.from({ length: MAX_CATEGORIZE_ITEMS + 1 }, () => ({ id: ID, description: "a" }));
    expect(() => parseCategorizeInput({ transactions: many })).toThrow(/Máximo/);
  });
});

describe("assertItemOwnership", () => {
  it("blocks items created for another user", () => {
    expect(() => assertItemOwnership({ clientUserId: "outro" }, "eu")).toThrow(/outra conta/);
    expect(() => assertItemOwnership({ clientUserId: "eu" }, "eu")).not.toThrow();
    // Meu Pluggy: sem clientUserId (protegido pelo índice único no banco)
    expect(() => assertItemOwnership({ clientUserId: null }, "eu")).not.toThrow();
  });
});

describe("public errors", () => {
  it("never exposes internal error details", () => {
    expect(publicErrorMessage(new Error('duplicate key value violates unique constraint "x" (secret)'))).toBe(
      "Erro interno. Tente novamente em alguns minutos.",
    );
    expect(errorStatus(new Error("x"))).toBe(500);
    expect(publicErrorMessage(new PublicError("Item ID inválido", 400))).toBe("Item ID inválido");
    expect(errorStatus(new PublicError("x", 409))).toBe(409);
  });
});
