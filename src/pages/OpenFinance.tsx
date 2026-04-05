import BankConnectionsManager from "@/components/openfinance/BankConnectionsManager";
import SyncedDashboard from "@/components/openfinance/SyncedDashboard";
import SyncedTransactionsList from "@/components/openfinance/SyncedTransactionsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRealtimeSyncNotifications } from "@/hooks/useRealtimeSyncNotifications";

const OpenFinance = () => {
  useRealtimeSyncNotifications();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Open Finance</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Sincronize suas contas bancárias e importe transações automaticamente
        </p>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm font-medium">Segurança e Privacidade</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          <div className="flex items-start gap-1 mt-1">
            <Lock className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>Conexão criptografada de ponta a ponta via Pluggy · Em conformidade com a LGPD · Seus dados nunca são compartilhados com terceiros</span>
          </div>
        </AlertDescription>
      </Alert>

      <BankConnectionsManager />
      <SyncedTransactionsList />
    </div>
  );
};

export default OpenFinance;
