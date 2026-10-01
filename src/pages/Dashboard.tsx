import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, Landmark, PiggyBank, Plus, AlertTriangle, Repeat, CalendarClock } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import StatCard from "@/components/StatCard";
import InfoHint from "@/components/InfoHint";
import TipCard from "@/components/TipCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCardSkeleton } from "@/components/skeletons";
import { useBankConnections, useSyncedInvestments } from "@/hooks/useBankConnections";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useInvestments } from "@/hooks/useInvestments";
import { usePreferences } from "@/hooks/usePreferences";
import {
  isRealFlow,
  monthForecast,
  monthSummary,
  recurringCharges,
  spendingByWeekday,
  summaryHeadline,
  topExpenseCategories,
  unusualSpending,
} from "@/lib/insights";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--accent-foreground))", "hsl(var(--muted-foreground))"];

const Dashboard = () => {
  const { isComplete } = usePreferences();
  const { connections, accounts, isLoading: loadingConn } = useBankConnections();
  const { transactions, isLoading: loadingTx } = useAllTransactions();
  const { investments, isLoading: loadingInv } = useSyncedInvestments();
  const { investments: manualInvestments, isLoading: loadingManualInv } = useInvestments();
  const loading = loadingConn || loadingTx || loadingInv || loadingManualInv;

  const data = useMemo(() => {
    const now = new Date();
    const cash = accounts.filter((a) => a.type !== "CREDIT").reduce((s, a) => s + Number(a.balance), 0);
    const debt = accounts.filter((a) => a.type === "CREDIT").reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
    // Investimentos do banco + carteira cadastrada à mão
    const invested =
      investments.reduce((s, i) => s + Number(i.balance), 0) +
      manualInvestments.reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0);
    const netWorth = cash - debt + invested;

    const monthKey = (d: string) => d.slice(0, 7);
    const months = Array.from({ length: 12 }, (_, i) => format(subMonths(startOfMonth(now), 11 - i), "yyyy-MM"));
    const flows = new Map<string, { income: number; expense: number }>(months.map((m) => [m, { income: 0, expense: 0 }]));
    const currentKey = format(now, "yyyy-MM");
    const byCategory = new Map<string, number>();

    for (const t of transactions) {
      if (!isRealFlow(t.category)) continue;
      const f = flows.get(monthKey(t.date));
      if (f) f[t.type === "income" ? "income" : "expense"] += Number(t.amount);
      if (t.type === "expense" && monthKey(t.date) === currentKey) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + Number(t.amount));
    }

    // Evolução: parte do patrimônio atual e desconta o saldo de cada mês para trás
    let running = netWorth;
    const evolution = [...months].reverse().map((m) => {
      const point = { month: m, value: running };
      const f = flows.get(m)!;
      running -= f.income - f.expense;
      return point;
    }).reverse();

    const label = (m: string) => format(new Date(`${m}-15T12:00`), "MMM/yy", { locale: ptBR });
    const summary = monthSummary(transactions, now);
    const recurring = recurringCharges(transactions, now);
    return {
      cash, debt, invested, netWorth, summary,
      headline: summaryHeadline(summary),
      top: topExpenseCategories(transactions, now, 3),
      alerts: unusualSpending(transactions, now),
      recurring,
      recurringTotal: recurring.reduce((s, r) => s + r.monthlyAmount, 0),
      forecast: monthForecast(transactions, now),
      weekdays: spendingByWeekday(transactions, now),
      evolution: evolution.map((p) => ({ ...p, label: label(p.month) })),
      cashFlow: months.slice(-6).map((m) => ({ label: label(m), Entradas: flows.get(m)!.income, Saídas: flows.get(m)!.expense })),
      categories: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
    };
  }, [accounts, investments, manualInvestments, transactions]);

  const monthLabel = (() => {
    const m = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
    return m.charAt(0).toUpperCase() + m.slice(1);
  })();
  const hasData = connections.length > 0 || transactions.length > 0 || manualInvestments.length > 0;
  const forecastHigh = data.forecast.previousAverage !== null && data.forecast.projected > data.forecast.previousAverage * 1.15;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Início</h1>
          <p className="text-muted-foreground text-sm mt-1">{monthLabel}</p>
        </div>
        <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
          <Link to="/expenses?nova=1"><Plus className="h-5 w-5" aria-hidden />Lançar transação</Link>
        </Button>
      </div>

      {!loading && !hasData ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-semibold">Nenhum dado ainda</h2>
            <p className="text-sm text-muted-foreground">Conecte seu banco, envie o extrato ou lance suas transações à mão.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild><Link to="/open-finance">Conectar banco ou enviar extrato</Link></Button>
              <Button asChild variant="outline"><Link to="/expenses?nova=1">Lançar transação</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo em uma frase */}
          {!loading && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 sm:p-6">
                <p className="text-base sm:text-lg font-medium leading-relaxed" aria-live="polite">{data.headline}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
              <>
                <StatCard title="Entrou no mês" value={brl(data.summary.income)} icon={TrendingUp} variant="success" />
                <StatCard title="Saiu no mês" value={brl(data.summary.expense)} icon={TrendingDown} variant="destructive" hint="transferencia" />
                <StatCard title="Sobrou" value={brl(data.summary.balance)} icon={PiggyBank} variant={data.summary.balance >= 0 ? "success" : "destructive"} hint="sobra" />
                <StatCard title="Dinheiro guardado" value={brl(data.netWorth)} icon={Wallet} hint="patrimonio" />
              </>
            )}
          </div>

          {/* Alertas */}
          {!loading && (data.alerts.length > 0 || forecastHigh) && (
            <section aria-labelledby="alerts-title" className="space-y-2">
              <h2 id="alerts-title" className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Fique de olho
              </h2>
              <ul className="space-y-2">
                {forecastHigh && (
                  <li className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                    No ritmo atual, você deve gastar <strong>{brl(data.forecast.projected)}</strong> este mês, acima da sua média de{" "}
                    {brl(data.forecast.previousAverage!)}.
                    <InfoHint term="previsao" className="ml-1" />
                  </li>
                )}
                {data.alerts.slice(0, 3).map((a) => (
                  <li key={a.category} className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                    Gastos com <strong>{a.category}</strong> estão {Math.round(a.abovePct)}% acima do normal: {brl(a.current)} este mês, contra
                    uma média de {brl(a.average)}.
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Maiores gastos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Onde você mais gastou</CardTitle>
                <CardDescription>As 3 categorias com mais gastos este mês</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum gasto neste mês ainda.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.top.map((c) => {
                      const pct = data.summary.expense > 0 ? (c.total / data.summary.expense) * 100 : 0;
                      return (
                        <li key={c.category} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{c.category}</span>
                            <span>{brl(c.total)} <span className="text-muted-foreground">({Math.round(pct)}%)</span></span>
                          </div>
                          <Progress value={pct} aria-label={`${c.category}: ${Math.round(pct)}% dos gastos`} />
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Button asChild variant="link" className="px-0 mt-2"><Link to="/expenses">Ver todas as transações</Link></Button>
              </CardContent>
            </Card>

            {/* Cobranças recorrentes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" aria-hidden />Cobranças que se repetem
                  <InfoHint term="recorrente" />
                </CardTitle>
                <CardDescription>
                  {data.recurring.length > 0
                    ? `${data.recurring.length} cobrança${data.recurring.length > 1 ? "s" : ""}, cerca de ${brl(data.recurringTotal)} por mês`
                    : "Nada recorrente encontrado nos últimos 3 meses"}
                </CardDescription>
              </CardHeader>
              {data.recurring.length > 0 && (
                <CardContent>
                  <ul className="divide-y text-sm">
                    {data.recurring.slice(0, isComplete ? 10 : 4).map((r) => (
                      <li key={r.name} className="flex justify-between gap-2 py-2">
                        <span className="truncate">{r.name}</span>
                        <span className="whitespace-nowrap font-medium">{brl(r.monthlyAmount)}/mês</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          </div>

          <TipCard page="home" />

          {/* Detalhes para quem quer explorar */}
          {isComplete && (
            <>
              {!loading && (
                <p className="text-xs text-muted-foreground">
                  Contas {brl(data.cash)} · Fatura do cartão −{brl(data.debt)} · Investimentos {brl(data.invested)}
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-primary" aria-hidden />Previsão do mês<InfoHint term="previsao" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Gasto até hoje: <strong>{brl(data.forecast.spentSoFar)}</strong></p>
                    <p>Previsão até o fim do mês: <strong>{brl(data.forecast.projected)}</strong></p>
                    {data.forecast.previousAverage !== null && (
                      <p className="text-muted-foreground">Média dos últimos meses: {brl(data.forecast.previousAverage)}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">Gastos por dia da semana</CardTitle>
                    <CardDescription>Últimos 3 meses</CardDescription>
                  </CardHeader>
                  <CardContent className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.weekdays.map((d) => ({ ...d, dia: d.day.slice(0, 3) }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="dia" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: number) => brl(v)} labelFormatter={(_, p) => p?.[0]?.payload?.day ?? ""} />
                        <Bar dataKey="total" name="Gasto" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">Evolução do dinheiro guardado<InfoHint term="patrimonio" /></CardTitle>
                  <CardDescription>Últimos 12 meses, estimada a partir das entradas e saídas</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.evolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={(v: number) => brl(v)} />
                      <Area type="monotone" dataKey="value" name="Dinheiro guardado" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base sm:text-lg">Entradas e saídas</CardTitle></CardHeader>
                  <CardContent className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.cashFlow}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: number) => brl(v)} />
                        <Legend />
                        <Bar dataKey="Entradas" fill="hsl(var(--success))" />
                        <Bar dataKey="Saídas" fill="hsl(var(--destructive))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base sm:text-lg">Gastos do mês por categoria</CardTitle></CardHeader>
                  <CardContent className="h-72">
                    {data.categories.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center pt-24">Nenhum gasto neste mês.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={data.categories} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                            {data.categories.map((c, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} aria-label={`${c.name}: ${brl(c.value)}`} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => brl(v)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!isComplete && (
            <p className="text-sm text-muted-foreground text-center">
              Quer ver gráficos, previsão do mês e investimentos? Ative o <strong>modo completo</strong> no menu.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
