import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import InfoHint from "@/components/InfoHint";
import { TIPS } from "@/lib/glossary";

const STORAGE_KEY = "nexos:dismissed-tips";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Mostra a primeira dica ainda não dispensada da página. Dispensar vale só neste navegador. */
const TipCard = ({ page }: { page: keyof typeof TIPS }) => {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const tip = TIPS[page]?.find((t) => !dismissed.includes(t.id));
  if (!tip) return null;

  const dismiss = () => {
    const next = [...dismissed, tip.id];
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* sem armazenamento: a dica volta na próxima visita */
    }
  };

  return (
    <aside className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4" aria-label="Dica">
      <Lightbulb className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium">
          {tip.title}
          {tip.learnMore && <InfoHint term={tip.learnMore} className="ml-1" />}
        </p>
        <p className="text-muted-foreground mt-0.5">{tip.text}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dismiss} aria-label="Dispensar dica">
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </aside>
  );
};

export default TipCard;
