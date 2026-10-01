import { useState } from "react";
import { ChevronDown, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePluggyAccount } from "@/hooks/useBankConnections";
import { cn } from "@/lib/utils";

/** Opção avançada: usar uma conta Pluggy própria em vez da conta do app. */
const PluggyAccountCard = () => {
  const { status, isLoading, save, remove } = usePluggyAccount();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
      { onSuccess: () => { setClientId(""); setClientSecret(""); } },
    );
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-start justify-between gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-primary" aria-hidden />
                  Avançado: usar uma conta Pluggy própria
                  {status?.configured && <Badge variant="secondary" className="text-[10px]">Ativa</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">
                  Para famílias: no plano gratuito da Pluggy cada conta aceita um só CPF, então cada pessoa pode ter a sua.
                </CardDescription>
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 mt-1 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando" />
            ) : status?.configured ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                  Usando a sua conta Pluggy (Client ID {status.clientId}).
                </p>
                <Button variant="outline" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  {remove.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />}
                  Remover
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Hoje esta conta usa a conta Pluggy do app.</p>
            )}

            <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-1">
              <li>Crie uma conta gratuita em dashboard.pluggy.ai com o e-mail e o CPF da pessoa dona desta conta do Nexos.</li>
              <li>Conecte o banco dela no Meu Pluggy (ela aprova no app do banco) e copie o Item ID.</li>
              <li>Cole abaixo o Client ID e o Client Secret dessa conta Pluggy e salve.</li>
              <li>Em "Conectar Banco", cole o Item ID.</li>
            </ol>

            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="pluggy-client-id">Client ID</Label>
                <Input id="pluggy-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" spellCheck={false} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pluggy-client-secret">Client Secret</Label>
                <Input id="pluggy-client-secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" spellCheck={false} />
              </div>
              <Button type="submit" disabled={!clientId.trim() || !clientSecret.trim() || save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />}
                {status?.configured ? "Trocar" : "Salvar"}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">
              As credenciais são conferidas com a Pluggy, guardadas criptografadas e nunca voltam para a tela.
              Conexões feitas antes com a conta do app precisam ser refeitas depois da troca.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default PluggyAccountCard;
