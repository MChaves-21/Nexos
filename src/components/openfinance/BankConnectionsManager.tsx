import { useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import {
  Building2, RefreshCw, Plus, Loader2, Link, Unlink, Clock, CheckCircle2, AlertCircle, FileText, KeyRound, CreditCard, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBankConnections, type BankConnection } from "@/hooks/useBankConnections";
import FileImportDialog from "./FileImportDialog";
import { accountTitle, amountLabel, creditUsage } from "@/lib/accounts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Conectores de teste ("Pluggy Bank") aparecem no widget; desligue com VITE_PLUGGY_INCLUDE_SANDBOX=false
const INCLUDE_SANDBOX = import.meta.env.VITE_PLUGGY_INCLUDE_SANDBOX !== "false";

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const BankConnectionsManager = () => {
  const {
    connections,
    accounts,
    isLoading,
    createConnectToken,
    saveConnection,
    deleteConnection,
    syncTransactions,
    setAutoSync,
  } = useBankConnections();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [manualItemId, setManualItemId] = useState("");
  const [manualInstitution, setManualInstitution] = useState("");
  // Widget aberto: token + item em atualização (reconexão), se houver
  const [widget, setWidget] = useState<{ token: string; updateItem?: string } | null>(null);

  const openWidget = async (updateItem?: string) => {
    const { accessToken } = await createConnectToken.mutateAsync(updateItem);
    setShowConnectDialog(false);
    setWidget({ token: accessToken, updateItem });
  };

  const handleManualConnect = async () => {
    if (!manualItemId.trim()) return;
    await saveConnection.mutateAsync({ itemId: manualItemId.trim(), institutionName: manualInstitution || undefined });
    setShowConnectDialog(false);
    setManualInstitution("");
    setManualItemId("");
  };

  const getStatusBadge = (conn: BankConnection) => {
    if (conn.provider === "file") {
      return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" /> Arquivo</Badge>;
    }
    switch (conn.status) {
      case "connected":
        return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>;
      case "syncing":
        return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Sincronizando</Badge>;
      case "outdated":
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"><Clock className="h-3 w-3 mr-1" /> Desatualizado</Badge>;
      case "reauth_required":
        return <Badge variant="destructive"><KeyRound className="h-3 w-3 mr-1" /> Reconectar</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  return (
    <Card>
      {widget && (
        <PluggyConnect
          connectToken={widget.token}
          updateItem={widget.updateItem}
          includeSandbox={INCLUDE_SANDBOX}
          language="pt"
          onSuccess={({ item }) => {
            setWidget(null);
            saveConnection.mutate({ itemId: item.id, institutionName: item.connector?.name });
          }}
          onError={({ message, data }) => {
            // Mesmo com erro o item pode ter sido criado (ex.: MFA pendente); salva para reconectar depois
            if (data?.item?.id) saveConnection.mutate({ itemId: data.item.id, institutionName: data.item.connector?.name });
            console.error("Pluggy Connect error:", message);
          }}
          onClose={() => setWidget(null)}
        />
      )}
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Conexões Bancárias
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Conecte via Open Finance (Pluggy) ou importe o extrato/fatura exportado do app do banco
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <FileImportDialog />
            <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Conectar Banco
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Conectar Instituição Bancária</DialogTitle>
                  <DialogDescription>
                    Autorize o acesso pelo Open Finance. O Nexos nunca vê nem guarda sua senha do banco.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <Button
                    onClick={() => openWidget()}
                    disabled={createConnectToken.isPending}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {createConnectToken.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                    Abrir Pluggy Connect
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Ou use um item do Meu Pluggy</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Conecte seu banco em meu.pluggy.ai e cole aqui o Item ID gerado. Ele é validado na Pluggy antes de salvar.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="manual-item-id">Item ID (Pluggy)</Label>
                      <Input
                        id="manual-item-id"
                        placeholder="ex.: 0f1e2d3c-..."
                        value={manualItemId}
                        onChange={(e) => setManualItemId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-institution">Nome (opcional)</Label>
                      <Input
                        id="manual-institution"
                        placeholder="Usa o nome do banco na Pluggy se vazio"
                        value={manualInstitution}
                        onChange={(e) => setManualInstitution(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleManualConnect}
                      disabled={!manualItemId.trim() || saveConnection.isPending}
                      className="w-full"
                      variant="outline"
                    >
                      {saveConnection.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Salvar conexão
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum banco conectado</p>
            <p className="text-xs mt-1">Conecte um banco ou importe um arquivo CSV/OFX</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => {
              const isPluggy = conn.provider === "pluggy";
              const isSyncing = syncTransactions.isPending && syncTransactions.variables === conn.id;
              const isDeleting = deleteConnection.isPending && deleteConnection.variables === conn.id;
              const needsReauth = conn.status === "reauth_required" || conn.status === "error";
              const connAccounts = accounts.filter((a) => a.bank_connection_id === conn.id);

              return (
                <div key={conn.id} className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {isPluggy ? <Building2 className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{conn.institution_name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(conn)}
                          {isPluggy && conn.bank_updated_at ? (
                            <span className="text-xs text-muted-foreground" title={conn.last_sync_at ? `Lido pelo Nexos em ${format(new Date(conn.last_sync_at), "dd/MM HH:mm")}` : undefined}>
                              Dados do banco de {format(new Date(conn.bank_updated_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          ) : conn.last_sync_at && (
                            <span className="text-xs text-muted-foreground">
                              {isPluggy ? "Última sync" : "Última importação"}:{" "}
                              {format(new Date(conn.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      {isPluggy && needsReauth && (
                        <Button
                          size="sm"
                          onClick={() => openWidget(conn.pluggy_item_id!)}
                          disabled={createConnectToken.isPending}
                          className="gap-1 flex-1 sm:flex-none"
                        >
                          <KeyRound className="h-3 w-3" />
                          Reconectar
                        </Button>
                      )}
                      {isPluggy && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncTransactions.mutate(conn.id)}
                          disabled={isSyncing}
                          className="gap-1 flex-1 sm:flex-none"
                        >
                          {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Sincronizar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteConnection.mutate(conn.id)}
                        disabled={isDeleting}
                        className="text-destructive hover:text-destructive"
                        aria-label="Remover conexão"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {conn.status_detail && <p className="text-xs text-muted-foreground">{conn.status_detail}</p>}

                  {conn.consent_expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Consentimento válido até {format(new Date(conn.consent_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}

                  {connAccounts.length > 0 && (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {connAccounts.map((acc) => {
                        const usage = creditUsage(acc);
                        return (
                          <div key={acc.id} className="text-xs rounded-md bg-muted/50 px-2 py-1.5 min-w-0" title={acc.name}>
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 min-w-0">
                                {acc.type === "CREDIT" ? <CreditCard className="h-3 w-3 flex-shrink-0" aria-hidden /> : <Wallet className="h-3 w-3 flex-shrink-0" aria-hidden />}
                                <span className="truncate font-medium">{accountTitle(acc)}</span>
                              </span>
                              <span className="whitespace-nowrap">
                                <span className="text-muted-foreground">{amountLabel(acc)} </span>
                                <span className="font-medium">{formatCurrency(acc.balance)}</span>
                              </span>
                            </div>
                            {usage && (
                              <p className="text-muted-foreground mt-0.5">
                                Limite usado {formatCurrency(usage.used)} de {formatCurrency(usage.limit)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isPluggy && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
                      <Switch
                        checked={conn.auto_sync}
                        onCheckedChange={(checked) => setAutoSync.mutate({ id: conn.id, autoSync: checked })}
                      />
                      Sincronizar automaticamente todo dia
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BankConnectionsManager;
