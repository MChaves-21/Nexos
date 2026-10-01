// Registro do service worker e do convite de instalação do app (PWA).

/** Só no app publicado: fora do modo de desenvolvimento e fora do preview do Lovable (iframe). */
export function shouldRegisterServiceWorker(env: { prod: boolean; inIframe: boolean; hasSW: boolean }): boolean {
  return env.prod && !env.inIframe && env.hasSW;
}

export function registerServiceWorker() {
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  if (!shouldRegisterServiceWorker({ prod: import.meta.env.PROD, inIframe, hasSW: "serviceWorker" in navigator })) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker não registrado:", e));
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const installPrompt = {
  available: () => deferred !== null,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async show(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
    return outcome === "accepted";
  },
};

/** iPhone/iPad não têm o convite automático: a pessoa usa Compartilhar → Adicionar à Tela de Início. */
export function isIos(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}
