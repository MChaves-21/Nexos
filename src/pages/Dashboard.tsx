import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const Dashboard = () => {
  // Mock data - será substituído por dados reais depois
  const patrimonioData = [
    { mes: "Jan", valor: 45000 },
    { mes: "Fev", valor: 48000 },
    { mes: "Mar", valor: 47500 },
    { mes: "Abr", valor: 51000 },
    { mes: "Mai", valor: 53500 },
    { mes: "Jun", valor: 56800 },
  ];

  const fluxoCaixaData = [
    { mes: "Jan", receitas: 8000, despesas: 5500 },
    { mes: "Fev", receitas: 8200, despesas: 5800 },
    { mes: "Mar", receitas: 8000, despesas: 6200 },
    { mes: "Abr", receitas: 8500, despesas: 5400 },
    { mes: "Mai", receitas: 8300, despesas: 5600 },
    { mes: "Jun", receitas: 8700, despesas: 5300 },
  ];

  const categoriesData = [
    { name: "Moradia", value: 2000, color: "hsl(var(--chart-1))" },
    { name: "Alimentação", value: 1200, color: "hsl(var(--chart-2))" },
    { name: "Transporte", value: 800, color: "hsl(var(--chart-3))" },
    { name: "Lazer", value: 600, color: "hsl(var(--chart-4))" },
    { name: "Outros", value: 700, color: "hsl(var(--chart-5))" },
  ];

  const investmentsData = [
    { name: "Ações", value: 25000, color: "hsl(var(--chart-1))" },
    { name: "FIIs", value: 15000, color: "hsl(var(--chart-2))" },
    { name: "Tesouro", value: 10000, color: "hsl(var(--chart-3))" },
    { name: "Renda Fixa", value: 8000, color: "hsl(var(--chart-4))" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h2>
        <p className="text-muted-foreground mt-1">
          Visão completa das suas finanças
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Patrimônio Líquido"
          value="R$ 56.800"
          icon={PiggyBank}
          trend={{ value: "5.6%", positive: true }}
          variant="success"
        />
        <StatCard
          title="Investimentos"
          value="R$ 58.000"
          icon={TrendingUp}
          trend={{ value: "3.2%", positive: true }}
          variant="success"
        />
        <StatCard
          title="Receitas (mês)"
          value="R$ 8.700"
          icon={TrendingUp}
          trend={{ value: "4.8%", positive: true }}
        />
        <StatCard
          title="Despesas (mês)"
          value="R$ 5.300"
          icon={TrendingDown}
          trend={{ value: "5.4%", positive: false }}
          variant="destructive"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Evolução Patrimonial</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={patrimonioData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)"
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fluxoCaixaData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)"
                  }}
                />
                <Legend />
                <Bar dataKey="receitas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoriesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoriesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Distribuição de Investimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={investmentsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {investmentsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
