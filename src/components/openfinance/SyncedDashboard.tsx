import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSyncedTransactions } from "@/hooks/useBankConnections";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, PieChart as PieIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#f97316",
  Transporte: "#3b82f6",
  Moradia: "#8b5cf6",
  Saúde: "#ef4444",
  Educação: "#06b6d4",
  Lazer: "#ec4899",
  Vestuário: "#f59e0b",
  Serviços: "#6366f1",
  Assinaturas: "#14b8a6",
  Compras: "#a855f7",
  Transferência: "#64748b",
  Investimento: "#22c55e",
  Salário: "#10b981",
  Freelance: "#84cc16",
  Outros: "#94a3b8",
};

const FALLBACK_COLORS = [
  "#f97316", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4",
  "#ec4899", "#f59e0b", "#6366f1", "#14b8a6", "#a855f7",
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const SyncedDashboard = () => {
  const { transactions, isLoading } = useSyncedTransactions();

  const stats = useMemo(() => {
    if (!transactions.length) return null;

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type !== "income")
      .reduce((s, t) => s + t.amount, 0);
    const reviewed = transactions.filter((t) => t.is_reviewed).length;
    const pending = transactions.length - reviewed;

    // Category breakdown (expenses only)
    const catMap = new Map<string, number>();
    transactions
      .filter((t) => t.type !== "income")
      .forEach((t) => {
        const cat = t.ai_category || t.original_category || "Outros";
        catMap.set(cat, (catMap.get(cat) || 0) + t.amount);
      });
    const categoryData = Array.from(catMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
        color: CATEGORY_COLORS[name] || FALLBACK_COLORS[catMap.size % FALLBACK_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    // Confidence distribution
    const confidenceBuckets = { high: 0, medium: 0, low: 0, none: 0 };
    transactions.forEach((t) => {
      if (t.ai_confidence === null) confidenceBuckets.none++;
      else if (t.ai_confidence >= 0.8) confidenceBuckets.high++;
      else if (t.ai_confidence >= 0.5) confidenceBuckets.medium++;
      else confidenceBuckets.low++;
    });

    const avgConfidence =
      transactions.filter((t) => t.ai_confidence !== null).length > 0
        ? transactions
            .filter((t) => t.ai_confidence !== null)
            .reduce((s, t) => s + (t.ai_confidence || 0), 0) /
          transactions.filter((t) => t.ai_confidence !== null).length
        : 0;

    // Top categories bar chart
    const topCategories = categoryData.slice(0, 7);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      reviewed,
      pending,
      total: transactions.length,
      categoryData,
      confidenceBuckets,
      avgConfidence,
      topCategories,
    };
  }, [transactions]);

  if (isLoading || !stats) {
    return null;
  }

  if (transactions.length === 0) return null;

  const confidenceData = [
    { name: "Alta (≥80%)", value: stats.confidenceBuckets.high, color: "#22c55e" },
    { name: "Média (50-79%)", value: stats.confidenceBuckets.medium, color: "#f59e0b" },
    { name: "Baixa (<50%)", value: stats.confidenceBuckets.low, color: "#ef4444" },
    { name: "Sem IA", value: stats.confidenceBuckets.none, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const reviewProgress = Math.round((stats.reviewed / stats.total) * 100);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Receitas
            </div>
            <p className="text-lg font-bold text-emerald-500">
              {formatCurrency(stats.totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              Despesas
            </div>
            <p className="text-lg font-bold text-red-500">
              {formatCurrency(stats.totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Brain className="h-3.5 w-3.5 text-primary" />
              Confiança IA
            </div>
            <p className="text-lg font-bold">
              {Math.round(stats.avgConfidence * 100)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {stats.pending > 0 ? (
                <Clock className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              Revisão
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold">{reviewProgress}%</p>
              <Progress value={reviewProgress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {stats.reviewed}/{stats.total} revisadas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Despesas por Categoria (IA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.categoryData.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-full sm:w-1/2 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {stats.categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-1.5 max-h-[200px] overflow-y-auto">
                  {stats.categoryData.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <span className="font-medium ml-2 whitespace-nowrap">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sem despesas categorizadas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Categories Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Top Categorias (valor)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topCategories.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.topCategories}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Valor"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {stats.topCategories.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sem dados
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confidence Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Distribuição de Confiança da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-1/3 h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={confidenceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {confidenceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3 w-full">
              {confidenceData.map((bucket, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{bucket.name}</p>
                    <p className="text-lg font-bold">{bucket.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {stats.confidenceBuckets.low > 0 && (
            <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-amber-600">{stats.confidenceBuckets.low} transações</span> com baixa confiança na categorização. Revise-as manualmente para melhorar a precisão.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncedDashboard;
