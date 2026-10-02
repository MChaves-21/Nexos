import { describe, expect, it } from "vitest";
import { entryScript, isIos, shouldRegisterServiceWorker } from "./pwa";

describe("pwa", () => {
  it("only registers the service worker in the published app", () => {
    expect(shouldRegisterServiceWorker({ prod: true, inIframe: false, hasSW: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ prod: false, inIframe: false, hasSW: true })).toBe(false);
    // Preview do Lovable roda dentro de um iframe: cache de service worker atrapalharia as atualizações
    expect(shouldRegisterServiceWorker({ prod: true, inIframe: true, hasSW: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ prod: true, inIframe: false, hasSW: false })).toBe(false);
  });

  it("detects iPhone for manual install instructions", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });

  it("finds the build entry script to detect a new version", () => {
    const html = '<head><script type="module" crossorigin src="/assets/index-AbC123.js"></script><link rel="modulepreload" href="/assets/vendor-x.js"></head>';
    expect(entryScript(html)).toBe("/assets/index-AbC123.js");
    expect(entryScript('<script type="module" src="/src/main.tsx"></script>')).toBeNull();
  });
});
