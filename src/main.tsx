import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, watchForNewVersion } from "./lib/pwa";

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
watchForNewVersion();
