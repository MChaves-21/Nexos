import { Switch } from "@/components/ui/switch";
import { usePreferences } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

/** Liga/desliga o modo completo (mais telas e detalhes). */
const ModeToggle = ({ className }: { className?: string }) => {
  const { isComplete, setUiMode, isLoading } = usePreferences();
  return (
    <label
      className={cn("flex items-start gap-3 rounded-lg border bg-card p-3 cursor-pointer", className)}
      htmlFor="ui-mode-toggle"
    >
      <Switch
        id="ui-mode-toggle"
        checked={isComplete}
        disabled={isLoading}
        onCheckedChange={(checked) => setUiMode(checked ? "complete" : "simple")}
        aria-describedby="ui-mode-help"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">Modo completo</span>
        <span id="ui-mode-help" className="block text-xs text-muted-foreground">
          {isComplete
            ? "Mostrando investimentos, simulador, relatórios e regras."
            : "Ative para ver investimentos, simulador, relatórios e mais detalhes."}
        </span>
      </span>
    </label>
  );
};

export default ModeToggle;
