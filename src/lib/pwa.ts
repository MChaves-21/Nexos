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

/** Script principal do build (/assets/index-<hash>.js) citado num HTML; muda a cada versão publicada. */
export function entryScript(html: string): string | null {
  return html.match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/)?.[1] ?? null;
}

const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * App aberto em segundo plano continua com a versão antiga na memória. Ao voltar para a tela,
 * confere se há versão nova publicada e recarrega (só nesse momento, para não atrapalhar quem está usando).
 */
export function watchForNewVersion() {
  if (!import.meta.env.PROD) return;
  const current = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute("src");
  if (!current) return;
  let lastCheck = Date.now();
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !navigator.onLine || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    try {
      const res = await fetch("/", { cache: "no-store" });
      const latest = res.ok ? entryScript(await res.text()) : null;
      if (latest && latest !== current) window.location.reload();
    } catch {
      /* sem rede: tenta na próxima vez */
    }
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
