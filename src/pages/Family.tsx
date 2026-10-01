import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Copy, Link2, Loader2, LogOut, Users, UserMinus, XCircle, Landmark, KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useFamily } from "@/hooks/useFamily";
import { inviteLink, memberHealth, type MemberHealth } from "@/lib/family";
import { cn } from "@/lib/utils";

const HEALTH_STYLE: Record<MemberHealth, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-success", label: "Tudo certo" },
  attention: { icon: AlertTriangle, className: "text-warning", label: "Atenção" },
  problem: { icon: XCircle, className: "text-destructive", label: "Precisa de ajuda" },
  "no-bank": { icon: Landmark, className: "text-muted-foreground", label: "Sem banco" },
};

const fmt = (d: string | null) => (d ? format(new Date(d), "dd/MM HH:mm", { locale: ptBR }) : "—");

/** Família: criar, convidar por link e acompanhar o estado das conexões (sem ver valores). */
const Family = () => {
  const f = useFamily();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [lastLink, setLastLink] = useState<string | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Link copiado", description: "Envie para a pessoa por mensagem. Ele vale por 7 dias e uma única vez." });
    } catch {
      toast({ title: "Copie o link manualmente", description: text });
    }
  };

  const newInvite = () =>
    f.createInvite.mutate(undefined, {
      onSuccess: (token) => {
        const link = inviteLink(window.location.origin, token);
        setLastLink(link);
        copy(link);
      },
    });

  if (f.isLoading) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Família</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cada pessoa tem a própria conta e só vê os próprios dados. O administrador vê apenas se as conexões estão funcionando.
        </p>
      </div>

      {f.unavailable && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">
          A família ainda não está disponível: o banco do app precisa da atualização mais recente.
        </CardContent></Card>
      )}

      {!f.unavailable && !f.family && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Users className="h-5 w-5 text-primary" aria-hidden />Criar uma família</CardTitle>
            <CardDescription>Você vira o administrador e pode convidar as pessoas por link. Se recebeu um convite, abra o link que te enviaram.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && displayName.trim()) f.createFamily.mutate({ name: name.trim(), displayName: displayName.trim() });
            }}>
              <div className="space-y-1.5">
                <Label htmlFor="family-name">Nome da família</Label>
                <Input id="family-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Família Chaves" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="family-me">Seu nome na família</Label>
                <Input id="family-me" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Murilo" />
              </div>
              <Button type="submit" disabled={!name.trim() || !displayName.trim() || f.createFamily.isPending}>Criar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {f.family && f.isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Painel de {f.family.name}</CardTitle>
              <CardDescription>Estado das conexões de cada pessoa. Valores e transações nunca aparecem aqui.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {f.overview.map((m) => {
                  const h = memberHealth(m);
                  const style = HEALTH_STYLE[h.level];
                  const Icon = style.icon;
                  return (
                    <li key={m.user_id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium flex items-center gap-2 flex-wrap">
                          {m.display_name}
                          {m.role === "admin" && <Badge variant="secondary" className="text-[10px]">Administrador</Badge>}
                          {m.has_own_pluggy && <Badge variant="outline" className="text-[10px] gap-1"><KeyRound className="h-3 w-3" aria-hidden />Pluggy própria</Badge>}
                        </p>
                        <p className={cn("text-sm flex items-center gap-1.5", style.className)}>
                          <Icon className="h-4 w-4 shrink-0" aria-hidden /><span className="sr-only">{style.label}: </span>{h.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.connections} conex{m.connections === 1 ? "ão" : "ões"} · última sincronização {fmt(m.last_sync_at)}
                          {m.next_consent_expiry && ` · consentimento até ${format(new Date(m.next_consent_expiry), "dd/MM/yyyy")}`}
                        </p>
                      </div>
                      {m.role !== "admin" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1 text-destructive self-start sm:self-auto"><UserMinus className="h-4 w-4" aria-hidden />Remover</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover {m.display_name} da família?</AlertDialogTitle>
                              <AlertDialogDescription>A conta e os dados dela continuam existindo; ela só deixa de aparecer no seu painel.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => f.removeMember.mutate(m.user_id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" aria-hidden />Convidar alguém</CardTitle>
              <CardDescription>Cada link serve para uma pessoa, uma única vez, por 7 dias. Ela cria a própria conta e já entra na família.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={newInvite} disabled={f.createInvite.isPending} className="gap-2">
                {f.createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
                Gerar link de convite
              </Button>
              {lastLink && (
                <div className="flex gap-2">
                  <Input readOnly value={lastLink} aria-label="Link de convite" onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="outline" size="icon" onClick={() => copy(lastLink)} aria-label="Copiar link"><Copy className="h-4 w-4" aria-hidden /></Button>
                </div>
              )}
              {f.invites.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Convites ainda não usados</p>
                  <ul className="space-y-1">
                    {f.invites.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span>Criado em {fmt(i.created_at)} · vale até {fmt(i.expires_at)}</span>
                        <Button variant="ghost" size="sm" onClick={() => f.revokeInvite.mutate(i.id)}>Cancelar</Button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-1">Por segurança, o link aparece só quando é gerado. Se perdeu, cancele e gere outro.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {f.family && !f.isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">{f.family.name}</CardTitle>
            <CardDescription>
              Administrador: {f.members?.find((m) => m.role === "admin")?.display_name ?? "—"}. Ele vê apenas se as suas conexões com o banco
              estão funcionando, para poder ajudar. Seus valores e transações continuam só seus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {f.members?.map((m) => <li key={m.user_id}>{m.display_name}{m.role === "admin" ? " (administrador)" : ""}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {f.family && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="gap-2 text-destructive"><LogOut className="h-4 w-4" aria-hidden />{f.isAdmin ? "Excluir a família" : "Sair da família"}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{f.isAdmin ? "Excluir a família?" : "Sair da família?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {f.isAdmin
                  ? "Todos deixam de fazer parte dela. As contas e os dados de cada pessoa continuam existindo."
                  : "O administrador deixa de ver o estado das suas conexões. Sua conta e seus dados continuam existindo."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => f.leave.mutate()}>{f.isAdmin ? "Excluir" : "Sair"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default Family;
