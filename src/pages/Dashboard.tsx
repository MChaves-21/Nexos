import { Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { useState } from "react";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<string | null>(null);

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

  const handleMonthClick = (data: any) => {
    setSelectedMonth(selectedMonth === data.mes ? null : data.mes);
    setSelectedCategory(null);
    setSelectedInvestment(null);
  };

  const handleCategoryClick = (data: any) => {
    setSelectedCategory(selectedCategory === data.name ? null : data.name);
    setSelectedMonth(null);
    setSelectedInvestment(null);
  };

  const handleInvestmentClick = (data: any) => {
    setSelectedInvestment(selectedInvestment === data.name ? null : data.name);
    setSelectedMonth(null);
    setSelectedCategory(null);
  };

  const clearFilters = () => {
    setSelectedMonth(null);
    setSelectedCategory(null);
    setSelectedInvestment(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h2>
        <p className="text-muted-foreground mt-1">
          Visão completa das suas finanças
        </p>
        {(selectedMonth || selectedCategory || selectedInvestment) && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {selectedMonth && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedMonth(null)}>
                Mês: {selectedMonth} ✕
              </Badge>
            )}
            {selectedCategory && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCategory(null)}>
                Categoria: {selectedCategory} ✕
              </Badge>
            )}
            {selectedInvestment && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedInvestment(null)}>
                Investimento: {selectedInvestment} ✕
              </Badge>
            )}
            <button onClick={clearFilters} className="text-sm text-primary hover:underline">
              Limpar todos
            </button>
          </div>
        )}
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
            <CardDescription>Clique em um ponto para filtrar detalhes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={patrimonioData} onClick={handleMonthClick}>
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
                  dot={(props) => {
                    const isSelected = selectedMonth === props.payload.mes;
                    return (
                      <circle
                        {...props}
                        fill={isSelected ? "hsl(var(--success))" : "hsl(var(--primary))"}
                        r={isSelected ? 6 : 4}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Fluxo de Caixa</CardTitle>
            <CardDescription>Clique em uma barra para filtrar detalhes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fluxoCaixaData} onClick={handleMonthClick}>
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
                <Bar 
                  dataKey="receitas" 
                  fill="hsl(var(--success))" 
                  radius={[4, 4, 0, 0]}
                  fillOpacity={selectedMonth ? 0.3 : 1}
                  style={{ cursor: 'pointer' }}
                />
                <Bar 
                  dataKey="despesas" 
                  fill="hsl(var(--destructive))" 
                  radius={[4, 4, 0, 0]}
                  fillOpacity={selectedMonth ? 0.3 : 1}
                  style={{ cursor: 'pointer' }}
                />
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
            <CardDescription>Clique em uma categoria para filtrar</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart onClick={handleCategoryClick}>
                <Pie
                  data={categoriesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  style={{ cursor: 'pointer' }}
                >
                  {categoriesData.map((entry, index) => {
                    const isSelected = selectedCategory === entry.name;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        opacity={isSelected ? 1 : selectedCategory ? 0.3 : 1}
                        strokeWidth={isSelected ? 3 : 0}
                        stroke="hsl(var(--foreground))"
                      />
                    );
                  })}
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
            <CardDescription>Clique em um investimento para filtrar</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart onClick={handleInvestmentClick}>
                <Pie
                  data={investmentsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  style={{ cursor: 'pointer' }}
                >
                  {investmentsData.map((entry, index) => {
                    const isSelected = selectedInvestment === entry.name;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        opacity={isSelected ? 1 : selectedInvestment ? 0.3 : 1}
                        strokeWidth={isSelected ? 3 : 0}
                        stroke="hsl(var(--foreground))"
                      />
                    );
                  })}
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
