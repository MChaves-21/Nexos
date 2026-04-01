import { useState } from "react";
import { Building2, RefreshCw, Trash2, Plus, Loader2, Link, Unlink, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBankConnections } from "@/hooks/useBankConnections";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BankConnectionsManager = () => {
  const {
    connections,
    isLoading,
    createConnectToken,
    saveConnection,
    deleteConnection,
    syncTransactions,
  } = useBankConnections();

  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [manualInstitution, setManualInstitution] = useState("");
  const [manualItemId, setManualItemId] = useState("");

  const handleConnect = async () => {
    try {
      // In sandbox mode, we'll use a manual flow
      // In production, this would open the Pluggy Connect widget
      if (manualInstitution && manualItemId) {
        await saveConnection.mutateAsync({
          itemId: manualItemId,
          institutionName: manualInstitution,
        });
        setShowConnectDialog(false);
        setManualInstitution("");
        setManualItemId("");
      }
    } catch (error) {
      console.error("Connect error:", error);
    }
  };

  const handlePluggyWidget = async () => {
    try {
      const result = await createConnectToken.mutateAsync();
      // In a full implementation, this would open the Pluggy Connect widget
      // For sandbox, we show a success message with the token
      console.log("Connect token:", result.accessToken);
      
      // Open Pluggy Connect widget URL
      const widgetUrl = `https://connect.pluggy.ai/?connect_token=${result.accessToken}`;
      window.open(widgetUrl, "_blank", "width=500,height=700");
    } catch (error) {
      console.error("Widget error:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>;
      case "syncing":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Sincronizando</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Conexões Bancárias
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Conecte seus bancos via Open Finance para sincronizar transações automaticamente
            </CardDescription>
          </div>
          <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                <span className="sm:inline">Conectar Banco</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conectar Instituição Bancária</DialogTitle>
                <DialogDescription>
                  Conecte seu banco via Open Finance para importar transações automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Button
                  onClick={handlePluggyWidget}
                  disabled={createConnectToken.isPending}
                  className="w-full gap-2"
                  size="lg"
                >
                  {createConnectToken.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                  Abrir Pluggy Connect
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Ou conecte manualmente (sandbox)
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nome da Instituição</Label>
                    <Input
                      placeholder="Ex: Banco do Brasil, Nubank..."
                      value={manualInstitution}
                      onChange={(e) => setManualInstitution(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Item ID (Pluggy)</Label>
                    <Input
                      placeholder="ID do item no Pluggy"
                      value={manualItemId}
                      onChange={(e) => setManualItemId(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={!manualInstitution || !manualItemId || saveConnection.isPending}
                    className="w-full"
                    variant="outline"
                  >
                    {saveConnection.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Salvar Conexão Manual
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
            <p className="text-xs mt-1">Conecte seus bancos para importar transações automaticamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{conn.institution_name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(conn.status)}
                      {conn.last_sync_at && (
                        <span className="text-xs text-muted-foreground">
                          Última sync: {format(new Date(conn.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncTransactions.mutate(conn.id)}
                    disabled={syncTransactions.isPending}
                    className="gap-1 flex-1 sm:flex-none"
                  >
                    {syncTransactions.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Sincronizar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteConnection.mutate(conn.id)}
                    disabled={deleteConnection.isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    {deleteConnection.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BankConnectionsManager;
