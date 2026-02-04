import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Criteria {
  label: string;
  met: boolean;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const criteria: Criteria[] = useMemo(() => [
    { label: "Mínimo 6 caracteres", met: password.length >= 6 },
    { label: "Letra maiúscula", met: /[A-Z]/.test(password) },
    { label: "Letra minúscula", met: /[a-z]/.test(password) },
    { label: "Número", met: /[0-9]/.test(password) },
    { label: "Caractere especial", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ], [password]);

  const strength = useMemo(() => {
    const metCount = criteria.filter(c => c.met).length;
    if (metCount === 0) return { level: 0, label: "", color: "" };
    if (metCount <= 2) return { level: 1, label: "Fraca", color: "bg-destructive" };
    if (metCount <= 3) return { level: 2, label: "Razoável", color: "bg-orange-500" };
    if (metCount <= 4) return { level: 3, label: "Boa", color: "bg-yellow-500" };
    return { level: 4, label: "Forte", color: "bg-emerald-500" };
  }, [criteria]);

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da senha</span>
          {strength.label && (
            <span className={cn(
              "text-xs font-medium",
              strength.level === 1 && "text-destructive",
              strength.level === 2 && "text-orange-500",
              strength.level === 3 && "text-yellow-600 dark:text-yellow-500",
              strength.level === 4 && "text-emerald-600 dark:text-emerald-500"
            )}>
              {strength.label}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                level <= strength.level ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Criteria List */}
      <div className="grid grid-cols-2 gap-1.5">
        {criteria.map((criterion, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors duration-200",
              criterion.met ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground"
            )}
          >
            {criterion.met ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <X className="h-3 w-3 shrink-0" />
            )}
            <span>{criterion.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;
