import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Download, Mail, ShieldCheck, Smartphone, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ModeToggle from "@/components/ModeToggle";
import InstallAppButton from "@/components/InstallAppButton";
import { useAccount } from "@/hooks/useAccount";
import { isIos, isStandalone } from "@/lib/pwa";

/** Conta e privacidade: preferências, instalação do app, exportar e excluir dados (LGPD). */
const Account = () => {
  const { user, prefs, savePrefs, exportData, deleteAccount } = useAccount();
  const [confirm, setConfirm] = useState("");
  const ios = typeof navigator !== "undefined" && isIos(navigator.userAgent);
  const installed = typeof window !== "undefined" && isStandalone();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Conta e privacidade</h1>
        <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Como o app aparece</CardTitle>
        </CardHeader>
        <CardContent>
          <ModeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-primary" aria-hidden />Avisos</CardTitle>
          <CardDescription>Os avisos aparecem no sino, no topo da tela. Eles são gerados uma vez por dia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer" htmlFor="pref-weekly">
            <Switch id="pref-weekly" checked={prefs?.weekly_summary ?? true}
              onCheckedChange={(v) => savePrefs.mutate({ weekly_summary: v })} aria-describedby="pref-weekly-help" />
            <span>
              <span className="block text-sm font-medium">Resumo semanal</span>
              <span id="pref-weekly-help" className="block text-xs text-muted-foreground">Toda segunda-feira, quanto entrou e saiu na semana anterior.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer" htmlFor="pref-email">
            <Switch id="pref-email" checked={prefs?.email_notifications ?? false}
              onCheckedChange={(v) => savePrefs.mutate({ email_notifications: v })} aria-describedby="pref-email-help" />
            <span>
              <span className="block text-sm font-medium flex items-center gap-1"><Mail className="h-3.5 w-3.5" aria-hidden />Receber também por e-mail</span>
              <span id="pref-email-help" className="block text-xs text-muted-foreground">Funciona quando o administrador do app configura o envio de e-mails.</span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" aria-hidden />Instalar no celular</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {installed ? (
            <p>O Nexos já está instalado neste aparelho.</p>
          ) : ios ? (
            <p>No iPhone: toque em <strong>Compartilhar</strong> (quadrado com seta) e depois em <strong>Adicionar à Tela de Início</strong>.</p>
          ) : (
            <>
              <p>No Android ou no computador: use o botão abaixo ou, no menu do navegador, <strong>Instalar app</strong> / <strong>Adicionar à tela inicial</strong>.</p>
              <InstallAppButton />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden />Seus dados</CardTitle>
          <CardDescription>
            Veja o que guardamos na <Link to="/privacy" className="underline">política de privacidade</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">Baixar meus dados</p>
              <p className="text-muted-foreground">Um arquivo com tudo o que está na sua conta.</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
              {exportData.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              Baixar
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3">
            <div className="text-sm">
              <p className="font-medium text-destructive">Excluir minha conta</p>
              <p className="text-muted-foreground">Apaga a conta e todos os dados, e encerra as conexões com bancos. Não dá para desfazer.</p>
            </div>
            <AlertDialog onOpenChange={(open) => !open && setConfirm("")}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" aria-hidden />Excluir conta</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir a conta de vez?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os seus lançamentos, metas, conexões e investimentos serão apagados. Se você administra uma família, ela também deixa
                    de existir (os outros membros continuam com as contas deles). Baixe seus dados antes, se quiser guardar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="confirm-delete">Digite EXCLUIR para confirmar</Label>
                  <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={confirm.trim().toUpperCase() !== "EXCLUIR" || deleteAccount.isPending}
                    onClick={(e) => { e.preventDefault(); deleteAccount.mutate(confirm); }}
                  >
                    {deleteAccount.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />}
                    Excluir para sempre
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Account;
