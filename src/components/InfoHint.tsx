import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/** Botão "?" que explica um termo. Usa popover (funciona no toque, ao contrário do tooltip). */
const InfoHint = ({ term, className }: { term: GlossaryKey; className?: string }) => {
  const entry = GLOSSARY[term];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring align-middle",
            className,
          )}
          aria-label={`O que é: ${entry.term}`}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        <p className="font-medium mb-1">{entry.term}</p>
        <p className="text-muted-foreground">{entry.text}</p>
      </PopoverContent>
    </Popover>
  );
};

export default InfoHint;
