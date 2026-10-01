import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FileUp, PenLine, Sparkles, Tags, Target, Eye, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePreferences, type UiMode } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

const STEPS = ["Bem-vindo", "Suas transações", "Categorias", "Primeira meta"] as const;

/** Primeiro acesso guiado. Aparece uma vez por conta (onboarding_completed no perfil). */
const OnboardingDialog = () => {
  const navigate = useNavigate();
  const { onboardingCompleted, isLoading, uiMode, setUiMode, completeOnboarding } = usePreferences();
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);

  const open = !isLoading && !onboardingCompleted && !closed;

  const finish = (to?: string) => {
    completeOnboarding();
    setClosed(true);
    if (to) navigate(to);
  };

  const chooseMode = (mode: UiMode) => {
    setUiMode(mode);
    setStep(1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && finish()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="text-xs font-medium text-muted-foreground">
            Passo {step + 1} de {STEPS.length}
          </p>
          <div className="flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
          {step === 0 && (
            <>
              <DialogTitle className="flex items-center gap-2 pt-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden />Bem-vindo ao Nexos
              </DialogTitle>
              <DialogDescription>
                O Nexos mostra para onde vai o seu dinheiro e ajuda você a guardar mais. Como você prefere começar?
              </DialogDescription>
            </>
          )}
          {step === 1 && (
            <>
              <DialogTitle className="pt-2">Traga suas transações</DialogTitle>
              <DialogDescription>Escolha o jeito mais fácil para você. Dá para usar mais de um depois.</DialogDescription>
            </>
          )}
          {step === 2 && (
            <>
              <DialogTitle className="pt-2">As categorias se ajustam sozinhas</DialogTitle>
              <DialogDescription>
                Cada transação recebe uma categoria (alimentação, transporte...). Se alguma estiver errada, é só trocar: o Nexos
                aprende e acerta as próximas parecidas.
              </DialogDescription>
            </>
          )}
          {step === 3 && (
            <>
              <DialogTitle className="pt-2">Crie sua primeira meta</DialogTitle>
              <DialogDescription>
                Defina um limite de gastos (ex.: R$ 600 por mês com comida) ou um valor para juntar (ex.: R$ 5.000 até dezembro).
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => chooseMode("simple")}
              className={cn("rounded-lg border p-4 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", uiMode === "simple" && "border-primary")}
            >
              <Eye className="h-5 w-5 text-primary mb-2" aria-hidden />
              <span className="block font-medium">Simples</span>
              <span className="block text-sm text-muted-foreground">Só o essencial: quanto entrou, saiu e sobrou.</span>
            </button>
            <button
              onClick={() => chooseMode("complete")}
              className={cn("rounded-lg border p-4 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", uiMode === "complete" && "border-primary")}
            >
              <Layers className="h-5 w-5 text-primary mb-2" aria-hidden />
              <span className="block font-medium">Completo</span>
              <span className="block text-sm text-muted-foreground">Também investimentos, simulador, gráficos e relatórios.</span>
            </button>
            <p className="sm:col-span-2 text-xs text-muted-foreground">Você pode mudar isso a qualquer momento no menu.</p>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-2">
            <Button variant="outline" className="h-auto justify-start gap-3 p-3 text-left whitespace-normal" onClick={() => finish("/open-finance")}>
              <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-medium">Conectar meu banco</span>
                <span className="block text-xs text-muted-foreground">Automático, pelo Open Finance. Ninguém vê sua senha.</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 p-3 text-left whitespace-normal" onClick={() => finish("/open-finance")}>
              <FileUp className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-medium">Enviar o extrato</span>
                <span className="block text-xs text-muted-foreground">Arquivo CSV ou OFX exportado do app do banco.</span>
              </span>
            </Button>
            <Button variant="outline" className="h-auto justify-start gap-3 p-3 text-left whitespace-normal" onClick={() => finish("/expenses?nova=1")}>
              <PenLine className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-medium">Lançar à mão</span>
                <span className="block text-xs text-muted-foreground">Anote cada gasto e ganho você mesmo.</span>
              </span>
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4 text-sm">
            <Tags className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <p>
              Exemplo: se "Padaria Central" vier como <em>Compras</em> e você trocar para <em>Alimentação</em>, as próximas
              compras na Padaria Central já chegam como Alimentação.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4 text-sm">
            <Target className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <p>Metas mostram uma barra de progresso e avisam quando você está chegando no limite.</p>
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => finish()}>
            Pular
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Voltar
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>{step === 1 ? "Fazer depois" : "Próximo"}</Button>
            ) : (
              <Button onClick={() => finish("/budgets")}>Criar meta</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDialog;
