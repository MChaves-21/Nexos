import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { clearPendingInvite, isInviteToken, savePendingInvite } from "@/lib/family";

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; family: string; admin: string | null };

/** Link de convite: /convite/:token. Sem login, guarda o convite e manda criar a conta. */
const InviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isInviteToken(token)) return setState({ kind: "invalid" });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        savePendingInvite(token);
        navigate("/auth?convite=1", { replace: true });
        return;
      }
      clearPendingInvite();
      const { data, error } = await supabase.rpc("peek_family_invite", { p_token: token });
      const row = data?.[0];
      if (error || !row || !row.valid) return setState({ kind: "invalid" });
      setState({ kind: "ready", family: row.family_name, admin: row.admin_name });
    })();
  }, [token, navigate]);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc("accept_family_invite", { p_token: token!, p_display_name: name.trim() });
    setSaving(false);
    if (error) return toast({ title: "Não foi possível entrar", description: friendlyErrorMessage(error), variant: "destructive" });
    toast({ title: "Você entrou na família!" });
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        {state.kind === "loading" && <CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando" /></CardContent>}
        {state.kind === "invalid" && (
          <CardHeader>
            <CardTitle>Convite inválido</CardTitle>
            <CardDescription>Este link expirou, já foi usado ou está incompleto. Peça um novo link para quem te convidou.</CardDescription>
            <Button className="mt-4" onClick={() => navigate("/")}>Ir para o Nexos</Button>
          </CardHeader>
        )}
        {state.kind === "ready" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" aria-hidden />Entrar em {state.family}</CardTitle>
              <CardDescription>
                {state.admin ? `${state.admin} te convidou.` : "Você foi convidado."} Seus valores e transações continuam só seus; o administrador
                vê apenas se a sua conexão com o banco está funcionando.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={accept} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name">Seu nome na família</Label>
                  <Input id="invite-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana" />
                </div>
                <Button type="submit" className="w-full" disabled={!name.trim() || saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />}Entrar na família
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
};

export default InviteAccept;
