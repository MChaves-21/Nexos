import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, Landmark } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCardSkeleton } from "@/components/skeletons";
import { useBankConnections, useSyncedInvestments } from "@/hooks/useBankConnections";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useInvestments } from "@/hooks/useInvestments";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))", "hsl(var(--warning, 38 92% 50%))", "hsl(var(--accent-foreground))", "hsl(var(--muted-foreground))"];

/** Ignora transferências e aplicações para não inflar receitas/despesas. */
const isFlow = (category: string | null) => category !== "Transferência" && category !== "Investimento";

const Dashboard = () => {
  const { connections, accounts, isLoading: loadingConn } = useBankConnections();
  const { transactions, isLoading: loadingTx } = useAllTransactions();
  const { investments, isLoading: loadingInv } = useSyncedInvestments();
  const { investments: manualInvestments, isLoading: loadingManualInv } = useInvestments();
  const loading = loadingConn || loadingTx || loadingInv || loadingManualInv;

  const data = useMemo(() => {
    const cash = accounts.filter((a) => a.type !== "CREDIT").reduce((s, a) => s + Number(a.balance), 0);
    const debt = accounts.filter((a) => a.type === "CREDIT").reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
    // Investimentos do banco + carteira cadastrada à mão
    const invested =
      investments.reduce((s, i) => s + Number(i.balance), 0) +
      manualInvestments.reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0);
    const netWorth = cash - debt + invested;

    const monthKey = (d: string) => d.slice(0, 7);
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => format(subMonths(startOfMonth(now), 11 - i), "yyyy-MM"));
    const flows = new Map<string, { income: number; expense: number }>(months.map((m) => [m, { income: 0, expense: 0 }]));
    const currentKey = format(now, "yyyy-MM");
    const byCategory = new Map<string, number>();

    for (const t of transactions) {
      const cat = t.category;
      if (!isFlow(cat)) continue;
      const f = flows.get(monthKey(t.date));
      if (f) f[t.type === "income" ? "income" : "expense"] += Number(t.amount);
      if (t.type === "expense" && monthKey(t.date) === currentKey) byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(t.amount));
    }

    // Evolução: parte do patrimônio atual e desconta o saldo de cada mês para trás
    let running = netWorth;
    const evolution = [...months].reverse().map((m) => {
      const point = { month: m, value: running };
      const f = flows.get(m)!;
      running -= f.income - f.expense;
      return point;
    }).reverse();

    const label = (m: string) => format(new Date(`${m}-15`), "MMM/yy", { locale: ptBR });
    return {
      cash, debt, invested, netWorth,
      month: flows.get(currentKey)!,
      evolution: evolution.map((p) => ({ ...p, label: label(p.month) })),
      cashFlow: months.slice(-6).map((m) => ({ label: label(m), Receitas: flows.get(m)!.income, Despesas: flows.get(m)!.expense })),
      categories: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
    };
  }, [accounts, investments, manualInvestments, transactions]);

  const hasData = connections.length > 0 || transactions.length > 0 || manualInvestments.length > 0;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Contas conectadas e lançamentos manuais</p>
      </div>

      {!loading && !hasData ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Nenhum dado ainda</h2>
            <p className="text-sm text-muted-foreground">Conecte seu banco ou registre transações e investimentos manualmente.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild><Link to="/open-finance">Conectar banco</Link></Button>
              <Button asChild variant="outline"><Link to="/expenses">Lançar transação</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
              <>
                <StatCard title="Patrimônio líquido" value={brl(data.netWorth)} icon={Wallet} />
                <StatCard title="Receitas do mês" value={brl(data.month.income)} icon={TrendingUp} variant="success" />
                <StatCard title="Despesas do mês" value={brl(data.month.expense)} icon={TrendingDown} variant="destructive" />
                <StatCard title="Investimentos" value={brl(data.invested)} icon={Landmark} />
              </>
            )}
          </div>

          {!loading && (
            <p className="text-xs text-muted-foreground">
              Contas {brl(data.cash)} · Fatura do cartão −{brl(data.debt)} · Investimentos {brl(data.invested)}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Evolução patrimonial</CardTitle>
              <CardDescription>Últimos 12 meses, estimada a partir das entradas e saídas do banco</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.evolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Area type="monotone" dataKey="value" name="Patrimônio" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base sm:text-lg">Receitas x Despesas</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.cashFlow}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => brl(v)} />
                    <Legend />
                    <Bar dataKey="Receitas" fill="hsl(var(--success))" />
                    <Bar dataKey="Despesas" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base sm:text-lg">Despesas do mês por categoria</CardTitle></CardHeader>
              <CardContent className="h-72">
                {data.categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center pt-24">Nenhuma despesa neste mês.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.categories} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                        {data.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
    </main>
  );
};

export default Dashboard;
