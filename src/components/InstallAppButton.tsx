import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { installPrompt } from "@/lib/pwa";

/** Botão "Instalar app": só aparece quando o navegador oferece a instalação. */
const InstallAppButton = () => {
  const [available, setAvailable] = useState(installPrompt.available());
  useEffect(() => installPrompt.subscribe(() => setAvailable(installPrompt.available())), []);
  if (!available) return null;
  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={() => installPrompt.show()}>
      <Download className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Instalar app</span>
      <span className="sm:hidden">Instalar</span>
    </Button>
  );
};

export default InstallAppButton;
