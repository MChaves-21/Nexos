import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Aviso fixo quando o aparelho fica sem internet. */
const OfflineBanner = () => {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground">
      <WifiOff className="h-4 w-4" aria-hidden />
      Você está sem internet. Os dados podem estar desatualizados.
    </div>
  );
};

export default OfflineBanner;
