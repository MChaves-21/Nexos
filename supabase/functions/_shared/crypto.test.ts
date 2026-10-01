import { describe, expect, it } from "vitest";
import { decryptText, deriveKey, encryptText, maskId } from "./crypto";

const SECRET = "segredo-do-servidor-de-teste-123";

describe("credential encryption", () => {
  it("round-trips and never stores the plain text", async () => {
    const key = await deriveKey(SECRET);
    const { ciphertext, iv } = await encryptText(key, "meu-client-secret", "user-a");
    expect(ciphertext).not.toContain("meu-client-secret");
    expect(await decryptText(key, ciphertext, iv, "user-a")).toBe("meu-client-secret");
  });

  it("uses a fresh IV each time", async () => {
    const key = await deriveKey(SECRET);
    const a = await encryptText(key, "x", "u");
    const b = await encryptText(key, "x", "u");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails if the row is copied to another user (AAD) or the server secret changes", async () => {
    const key = await deriveKey(SECRET);
    const { ciphertext, iv } = await encryptText(key, "s", "user-a");
    await expect(decryptText(key, ciphertext, iv, "user-b")).rejects.toThrow();
    const other = await deriveKey("outro-segredo-do-servidor-456789");
    await expect(decryptText(other, ciphertext, iv, "user-a")).rejects.toThrow();
  });

  it("rejects a missing server secret and masks ids", async () => {
    await expect(deriveKey("")).rejects.toThrow(/Segredo/);
    expect(maskId("0f1e2d3c-4b5a-4968-8776-655443329f0e")).toBe("••••9f0e");
  });
});
