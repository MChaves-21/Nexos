import { describe, expect, it } from "vitest";
import { friendlyErrorMessage, isChunkLoadError, isMissingSchemaError, shouldRetry } from "./errors";

describe("friendlyErrorMessage", () => {
  it("translates common technical errors", () => {
    expect(friendlyErrorMessage(new TypeError("Failed to fetch"))).toMatch(/internet/);
    expect(friendlyErrorMessage({ message: "JWT expired", status: 401 })).toMatch(/sessão expirou/);
    expect(friendlyErrorMessage({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/permissão/);
    expect(friendlyErrorMessage({ code: "PGRST204", message: "Could not find the 'ui_mode' column of 'profiles' in the schema cache" })).toMatch(/ainda não foi atualizado/);
    expect(friendlyErrorMessage({ code: "23505", message: "duplicate key value" })).toBe("Esse registro já existe.");
    expect(friendlyErrorMessage(new Error("Failed to fetch dynamically imported module: /assets/x.js"))).toMatch(/Recarregue/);
  });

  it("keeps Portuguese messages from our functions and hides unknown technical ones", () => {
    expect(friendlyErrorMessage(new Error("Este banco já está conectado a outra conta do Nexos."))).toBe("Este banco já está conectado a outra conta do Nexos.");
    expect(friendlyErrorMessage(new Error("TypeError: cannot read properties of undefined (reading 'x')"))).toBe("Algo deu errado. Tente novamente em instantes.");
    expect(friendlyErrorMessage(undefined)).toBe("Algo deu errado. Tente novamente em instantes.");
  });
});

describe("helpers", () => {
  it("detects schema and chunk errors", () => {
    expect(isMissingSchemaError({ code: "42703" })).toBe(true);
    expect(isMissingSchemaError({ message: "relation \"x\" does not exist" })).toBe(true);
    expect(isMissingSchemaError({ message: "timeout" })).toBe(false);
    expect(isChunkLoadError(new Error("Loading chunk 12 failed"))).toBe(true);
  });

  it("does not retry client errors", () => {
    expect(shouldRetry(0, { status: 403 })).toBe(false);
    expect(shouldRetry(0, { code: "PGRST204" })).toBe(false);
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(2, new TypeError("Failed to fetch"))).toBe(false);
  });
});
