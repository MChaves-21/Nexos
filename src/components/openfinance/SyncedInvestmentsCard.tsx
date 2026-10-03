import { useMemo } from "react";
import { Landmark, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBankConnections, useInvestmentBalanceHistory, useSyncedInvestments, useSyncedTransactions } from "@/hooks/useBankConnections";
import { estimateYield } from "@/lib/yieldEstimate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { bankProfit } from "@/lib/portfolio";
import { resolveCategory } from "@shared/categorization";

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
  const { investments: allInvestments, isLoading } = useSyncedInvestments();
  // Posições zeradas (resgatadas) não aparecem nem somam
  const investments = useMemo(() => allInvestments.filter((i) => Number(i.balance) > 0), [allInvestments]);
  const { accounts } = useBankConnections();
  const { transactions } = useSyncedTransactions();
  const history = useInvestmentBalanceHistory();

  const totals = useMemo(() => {
    const balance = investments.reduce((s, i) => s + Number(i.balance), 0);
    // Rendimento só das posições em que o banco informa; as outras não contam como zero
    const profits = investments.map(bankProfit);
    const known = profits.filter((p): p is number => p !== null);
    const profit = known.length ? known.reduce((s, p) => s + p, 0) : null;
    const unknown = profits.length - known.length;
    const byType = new Map<string, number>();
    for (const i of investments) byType.set(i.type, (byType.get(i.type) ?? 0) + Number(i.balance));
    // Dinheiro parado na conta (não cartão): para o "total no banco"
    const inAccounts = accounts.filter((a) => a.type === "BANK").reduce((s, a) => s + Number(a.balance), 0);

    // Sem rendimento informado: estima pela variação do saldo, por conexão, descontando aportes e resgates
    let estimate: { value: number; since: string } | null = null;
    if (profit === null) {
      for (const connId of new Set(history.map((h) => h.bank_connection_id))) {
        const e = estimateYield(
          history.filter((h) => h.bank_connection_id === connId),
          transactions
            .filter((t) => t.bank_connection_id === connId)
            .map((t) => ({ date: t.date, amount: Number(t.amount), type: t.type, description: t.description, category: resolveCategory(t.ai_category, t.original_category) })),
        );
        if (e) estimate = { value: (estimate?.value ?? 0) + e.value, since: estimate && estimate.since < e.since ? estimate.since : e.since };
      }
    }
    return { balance, profit, unknown, inAccounts, estimate, byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]) };
  }, [investments, accounts, transactions, history]);

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
                <p className="text-xs text-muted-foreground">Investimentos</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.balance)}</p>
                {totals.inAccounts > 0 && (
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    + {formatCurrency(totals.inAccounts)} na conta = <span className="font-medium text-foreground">{formatCurrency(totals.balance + totals.inAccounts)}</span> no banco
                  </p>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Rendimento</p>
                {totals.profit === null && totals.estimate ? (
                  <>
                    <p className={`text-lg font-semibold ${totals.estimate.value >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      ≈ {formatCurrency(totals.estimate.value)}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Desde {format(new Date(`${totals.estimate.since}T12:00`), "dd/MM")}, pela variação do saldo sem aportes e resgates. Inclui valorização das ações.
                    </p>
                  </>
                ) : totals.profit === null ? (
                  <>
                    <p className="text-lg font-semibold text-muted-foreground">Calculando…</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      O banco não envia quanto rendeu. O Nexos estima pela variação do saldo a partir do segundo dia de sincronização.
                    </p>
                  </>
                ) : (
                  <>
                    <p className={`text-lg font-semibold flex items-center gap-1 ${totals.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {totals.profit >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />}
                      {formatCurrency(totals.profit)}
                    </p>
                    {totals.unknown > 0 && (
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {totals.unknown} {totals.unknown === 1 ? "posição sem" : "posições sem"} rendimento informado pelo banco
                      </p>
                    )}
                  </>
                )}
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
                    {bankProfit(inv) !== null && (
                      <p className={`text-[11px] ${bankProfit(inv)! >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {bankProfit(inv)! >= 0 ? "+" : ""}
                        {formatCurrency(bankProfit(inv)!)}
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
