import { createRoot } from "react-dom/client";
import "./index.css";
import { registerServiceWorker, watchForNewVersion } from "./lib/pwa";
import { canonicalRedirect } from "./lib/canonical";

let framed = true;
try {
  framed = window.self !== window.top;
} catch {
  framed = true;
}

const target = canonicalRedirect(window.location, framed);
if (target) {
  // Site antigo no lovable.app: vai para a Vercel ANTES de carregar o app, para o login não
  // consumir aqui o token do link de e-mail (ele precisa chegar intacto à Vercel)
  window.location.replace(target);
} else {
  import("./App.tsx").then(({ default: App }) => {
    createRoot(document.getElementById("root")!).render(<App />);
    registerServiceWorker();
    watchForNewVersion();
  });
}
