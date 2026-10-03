import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "./canonical";

const at = (url: string) => {
  const u = new URL(url);
  return { hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash };
};
const C = "https://nexos-sage.vercel.app";

describe("canonicalRedirect", () => {
  it("leva o site antigo do Lovable para a Vercel, com o token do e-mail", () => {
    expect(canonicalRedirect(at("https://nexos.lovable.app/#access_token=abc&type=signup"), false, C))
      .toBe(`${C}/#access_token=abc&type=signup`);
    expect(canonicalRedirect(at("https://nexos.lovable.app/reset-password?code=xyz"), false, C)).toBe(`${C}/reset-password?code=xyz`);
    expect(canonicalRedirect(at(`https://nexos.lovable.app/convite/${"a".repeat(64)}`), false, C)).toBe(`${C}/convite/${"a".repeat(64)}`);
  });

  it("não mexe na Vercel, no editor nem nas prévias do Lovable", () => {
    expect(canonicalRedirect(at(`${C}/bills`), false, C)).toBeNull();
    expect(canonicalRedirect(at("https://nexos.lovable.app/"), true, C)).toBeNull();
    expect(canonicalRedirect(at("https://id-preview--4516186a-57b4-4d51-a52e-a158b85f73f1.lovable.app/"), false, C)).toBeNull();
    expect(canonicalRedirect(at("https://preview--nexos.lovable.app/"), false, C)).toBeNull();
    expect(canonicalRedirect(at("https://abc.lovableproject.com/"), false, C)).toBeNull();
    expect(canonicalRedirect(at("http://localhost:8080/"), false, C)).toBeNull();
  });
});
