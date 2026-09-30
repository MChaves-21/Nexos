import { useMemo } from "react";
import { Landmark, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSyncedInvestments } from "@/hooks/useBankConnections";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  SECURITY: "Previdência",
  MUTUAL_FUND: "Fundo",
  EQUITY: "Ações",
  ETF: "ETF",
  COE: "COE",
  OTHER: "Outros",
};

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Investimentos lidos do banco via Open Finance (somente leitura; a carteira manual continua separada). */
const SyncedInvestmentsCard = ({ hideWhenEmpty = false }: { hideWhenEmpty?: boolean }) => {
  const { investments, isLoading } = useSyncedInvestments();

  const totals = useMemo(() => {
    const balance = investments.reduce((s, i) => s + Number(i.balance), 0);
    const profit = investments.reduce((s, i) => s + Number(i.amount_profit ?? 0), 0);
    const byType = new Map<string, number>();
    for (const i of investments) byType.set(i.type, (byType.get(i.type) ?? 0) + Number(i.balance));
    return { balance, profit, byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]) };
  }, [investments]);

  if (hideWhenEmpty && !isLoading && investments.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Landmark className="h-5 w-5 text-primary" />
          Investimentos no banco
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Posições lidas via Open Finance, atualizadas a cada sincronização
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : investments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Landmark className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Nenhum investimento sincronizado</p>
            <p className="text-xs mt-1">Conecte um banco via Pluggy para ver caixinhas, CDBs, fundos etc.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Saldo total</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.balance)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Rendimento informado</p>
                <p className={`text-lg font-semibold flex items-center gap-1 ${totals.profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {totals.profit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {formatCurrency(totals.profit)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {totals.byType.map(([type, value]) => (
                <Badge key={type} variant="secondary" className="text-[11px]">
                  {TYPE_LABELS[type] ?? type}: {formatCurrency(value)}
                </Badge>
              ))}
            </div>

            <div className="space-y-1">
              {investments.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[inv.type] ?? inv.type}
                      {inv.issuer ? ` · ${inv.issuer}` : ""}
                      {inv.rate != null ? ` · ${inv.rate}%${inv.rate_type ? ` ${inv.rate_type}` : ""}` : ""}
                      {inv.due_date ? ` · vence ${format(new Date(`${inv.due_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold whitespace-nowrap">{formatCurrency(Number(inv.balance))}</p>
                    {inv.amount_profit != null && (
                      <p className={`text-[11px] ${Number(inv.amount_profit) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {Number(inv.amount_profit) >= 0 ? "+" : ""}
                        {formatCurrency(Number(inv.amount_profit))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncedInvestmentsCard;
