import { Wallet, TrendingUp, TrendingDown, PiggyBank, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/useTransactions";
import { useInvestments } from "@/hooks/useInvestments";
import { useGoals } from "@/hooks/useGoals";
import { cn } from "@/lib/utils";
import { StatCardSkeleton, ChartSkeleton } from "@/components/skeletons";
import WealthEvolutionChart from "@/components/charts/WealthEvolutionChart";

const Dashboard = () => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [startYear, setStartYear] = useState<string>((new Date().getFullYear() - 2).toString());
  const [endYear, setEndYear] = useState<string>(new Date().getFullYear().toString());
  const [categoryMonthOffset, setCategoryMonthOffset] = useState(0);
  const [cashFlowMonthOffset, setCashFlowMonthOffset] = useState(0);

  const { transactions, isLoading: loadingTransactions } = useTransactions();
  const { investments, isLoading: loadingInvestments } = useInvestments();
  const { goals, isLoading: loadingGoals } = useGoals();

  // Calcular dados reais a partir das transações e investimentos
  const dashboardData = useMemo(() => {
    if (loadingTransactions || loadingInvestments || loadingGoals) {
      return null;
    }

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const currentYear = new Date().getFullYear();
    
    // Usar todas as transações (sem filtro de período)
    const filteredTransactions = transactions;

    // Usar todos os investimentos (sem filtro de período)
    const filteredInvestments = investments;
    
    // Agrupar transações por mês
    const monthlyData: { [key: string]: { income: number; expense: number; month: number; year: number } } = {};
    
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, month: date.getMonth(), year: date.getFullYear() };
      }
      
      if (transaction.type === 'income') {
        monthlyData[monthKey].income += transaction.amount;
      } else {
        monthlyData[monthKey].expense += transaction.amount;
      }
    });

    // Calcular patrimônio acumulado por mês (últimos 6 meses)
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      last6Months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        name: monthNames[date.getMonth()]
      });
    }

    let accumulatedWealth = 0;
    const patrimonioData = last6Months.map(({ month, year, name }) => {
      const key = `${year}-${month}`;
      const data = monthlyData[key] || { income: 0, expense: 0 };
      accumulatedWealth += data.income - data.expense;
      return {
        mes: name,
        valor: Math.max(0, accumulatedWealth)
      };
    });

    // Fluxo de caixa (últimos 6 meses)
    const fluxoCaixaData = last6Months.map(({ month, year, name }) => {
      const key = `${year}-${month}`;
      const data = monthlyData[key] || { income: 0, expense: 0 };
      return {
        mes: name,
        receitas: data.income,
        despesas: data.expense
      };
    });

    // Gastos por categoria - calculado externamente com categoryMonthOffset
    const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense');

    // Distribuição de investimentos por tipo (filtrado por período)
    const investmentsByType: { [key: string]: number } = {};
    filteredInvestments.forEach(investment => {
      const currentValue = investment.current_price * investment.quantity;
      if (!investmentsByType[investment.asset_type]) {
        investmentsByType[investment.asset_type] = 0;
      }
      investmentsByType[investment.asset_type] += currentValue;
    });

    const investmentsData = Object.entries(investmentsByType).map(([name, value], index) => ({
      name,
      value,
      color: `hsl(var(--chart-${(index % 5) + 1}))`
    }));

    // Calcular totais (usando investimentos filtrados)
    const totalInvested = filteredInvestments.reduce((sum, inv) => sum + (inv.purchase_price * inv.quantity), 0);
    const totalCurrentInvestments = filteredInvestments.reduce((sum, inv) => sum + (inv.current_price * inv.quantity), 0);
    
    const currentMonthIncome = fluxoCaixaData[fluxoCaixaData.length - 1]?.receitas || 0;
    const currentMonthExpense = fluxoCaixaData[fluxoCaixaData.length - 1]?.despesas || 0;
    const previousMonthIncome = fluxoCaixaData[fluxoCaixaData.length - 2]?.receitas || 0;
    const previousMonthExpense = fluxoCaixaData[fluxoCaixaData.length - 2]?.despesas || 0;

    const netWorth = patrimonioData[patrimonioData.length - 1]?.valor || 0;
    const previousNetWorth = patrimonioData[patrimonioData.length - 2]?.valor || 0;
    
    const incomeTrend = previousMonthIncome > 0 
      ? ((currentMonthIncome - previousMonthIncome) / previousMonthIncome * 100).toFixed(1)
      : "0.0";
    const expenseTrend = previousMonthExpense > 0
      ? ((currentMonthExpense - previousMonthExpense) / previousMonthExpense * 100).toFixed(1)
      : "0.0";
    const wealthTrend = previousNetWorth > 0
      ? ((netWorth - previousNetWorth) / previousNetWorth * 100).toFixed(1)
      : "0.0";
    const investmentTrend = totalInvested > 0
      ? (((totalCurrentInvestments - totalInvested) / totalInvested) * 100).toFixed(1)
      : "0.0";

    // Dados de comparação ano a ano
    const yearlyData: { [key: string]: { [month: number]: number } } = {};
    const years = [currentYear, currentYear - 1, currentYear - 2];
    
    years.forEach(year => {
      yearlyData[year] = {};
      for (let month = 0; month < 12; month++) {
        yearlyData[year][month] = 0;
      }
    });

    // Calcular patrimônio acumulado por ano
    years.forEach(year => {
      let accumulated = 0;
      for (let month = 0; month < 12; month++) {
        const key = `${year}-${month}`;
        const data = monthlyData[key] || { income: 0, expense: 0 };
        accumulated += data.income - data.expense;
        yearlyData[year][month] = Math.max(0, accumulated);
      }
    });

    const yearlyComparisonData = monthNames.map((mes, index) => {
      const dataPoint: any = { mes };
      years.forEach(year => {
        dataPoint[year.toString()] = yearlyData[year][index];
      });
      return dataPoint;
    });

    // Receitas vs Despesas Anuais (filtrado por período)
    const yearlyIncomeData = years.map(year => {
      let totalIncome = 0;
      let totalExpense = 0;
      
      filteredTransactions.forEach(transaction => {
        const date = new Date(transaction.date);
        if (date.getFullYear() === year) {
          if (transaction.type === 'income') {
            totalIncome += transaction.amount;
          } else {
            totalExpense += transaction.amount;
          }
        }
      });

      return {
        ano: year.toString(),
        receitas: totalIncome,
        despesas: totalExpense,
        economia: totalIncome - totalExpense
      };
    }).reverse();

    // Calcular estatísticas anuais
    const currentYearWealth = yearlyData[currentYear][11] || 0; // Dezembro do ano atual
    const lastYearWealth = yearlyData[currentYear - 1][11] || 0; // Dezembro do ano anterior
    
    const wealthGrowthPercentage = lastYearWealth > 0 
      ? (((currentYearWealth - lastYearWealth) / lastYearWealth) * 100)
      : 0;

    // Economia média anual (últimos anos com dados)
    const yearsWithData = yearlyIncomeData.filter(y => y.economia > 0);
    const averageAnnualSavings = yearsWithData.length > 0
      ? yearsWithData.reduce((sum, y) => sum + y.economia, 0) / yearsWithData.length
      : 0;

    // Taxa de crescimento anual média (últimos 3 anos)
    const growthRates = [];
    for (let i = 0; i < years.length - 1; i++) {
      const currentYearData = yearlyData[years[i]][11] || 0;
      const previousYearData = yearlyData[years[i + 1]][11] || 0;
      
      if (previousYearData > 0) {
        const rate = ((currentYearData - previousYearData) / previousYearData) * 100;
        growthRates.push(rate);
      }
    }
    
    const averageGrowthRate = growthRates.length > 0
      ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
      : 0;

    // Dados de evolução das metas
    const goalsData = goals.map(goal => ({
      name: goal.title,
      progresso: Math.min((goal.current_amount / goal.target_amount) * 100, 100),
      atual: goal.current_amount,
      meta: goal.target_amount,
      concluida: goal.completed
    })).sort((a, b) => b.progresso - a.progresso);

    return {
      patrimonioData,
      fluxoCaixaData,
      allTransactions: filteredTransactions,
      expenseTransactions,
      investmentsData,
      stats: {
        netWorth,
        totalCurrentInvestments,
        currentMonthIncome,
        currentMonthExpense,
        wealthTrend: parseFloat(wealthTrend),
        investmentTrend: parseFloat(investmentTrend),
        incomeTrend: parseFloat(incomeTrend),
        expenseTrend: parseFloat(expenseTrend)
      },
      yearlyComparisonData,
      yearlyIncomeData,
      availableYears: years.map(y => y.toString()),
      annualStats: {
        wealthGrowth: {
          percentage: wealthGrowthPercentage,
          from: lastYearWealth,
          to: currentYearWealth
        },
        averageAnnualSavings,
        averageGrowthRate
      },
      goalsData
    };
  }, [transactions, investments, goals, loadingTransactions, loadingInvestments, loadingGoals]);

  // Calcular categoriesData dinamicamente com base no mês selecionado
  const categoryViewDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + categoryMonthOffset);
    return d;
  }, [categoryMonthOffset]);

  const categoriesData = useMemo(() => {
    const expTxns = dashboardData?.expenseTransactions ?? [];
    const targetMonth = categoryViewDate.getMonth();
    const targetYear = categoryViewDate.getFullYear();
    
    const categoryData: { [key: string]: number } = {};
    expTxns
      .filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
      })
      .forEach(t => {
        categoryData[t.category] = (categoryData[t.category] || 0) + t.amount;
      });

    return Object.entries(categoryData).map(([name, value], index) => ({
      name,
      value,
      color: `hsl(var(--chart-${(index % 5) + 1}))`
    }));
  }, [dashboardData?.expenseTransactions, categoryViewDate]);

  // Calcular fluxo de caixa dinamicamente com base no mês selecionado
  const cashFlowViewDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + cashFlowMonthOffset);
    return d;
  }, [cashFlowMonthOffset]);

  const cashFlowData = useMemo(() => {
    const allTxns = dashboardData?.allTransactions ?? [];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // Build 6 months ending at cashFlowViewDate
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cashFlowViewDate);
      d.setMonth(d.getMonth() - i);
      months.push({ month: d.getMonth(), year: d.getFullYear(), name: monthNames[d.getMonth()] });
    }

    return months.map(({ month, year, name }) => {
      let receitas = 0;
      let despesas = 0;
      allTxns.forEach(t => {
        const date = new Date(t.date);
        if (date.getMonth() === month && date.getFullYear() === year) {
          if (t.type === 'income') receitas += t.amount;
          else despesas += t.amount;
        }
      });
      return { mes: name, receitas, despesas };
    });
  }, [dashboardData?.allTransactions, cashFlowViewDate]);

  if (loadingTransactions || loadingInvestments || loadingGoals || !dashboardData) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h2>
          <p className="text-muted-foreground mt-1">
            Visão completa das suas finanças
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton height={250} />
          <ChartSkeleton height={250} />
        </div>
      </div>
    );
  }

  const { patrimonioData, fluxoCaixaData, stats, yearlyIncomeData, availableYears, annualStats, goalsData } = dashboardData;


  const filteredYearlyIncomeData = useMemo(() => {
    return (dashboardData?.yearlyIncomeData ?? []).filter(d => {
      const y = parseInt(d.ano);
      return y >= parseInt(startYear) && y <= parseInt(endYear);
    });
  }, [dashboardData?.yearlyIncomeData, startYear, endYear]);

  const handleMonthClick = (data: any) => {
    setSelectedMonth(selectedMonth === data.mes ? null : data.mes);
    setSelectedCategory(null);
  };

  const handleCategoryClick = (data: any) => {
    setSelectedCategory(selectedCategory === data.name ? null : data.name);
    setSelectedMonth(null);
  };

  const clearFilters = () => {
    setSelectedMonth(null);
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Financeiro</h2>
        <p className="text-muted-foreground mt-1">
          Visão completa das suas finanças
        </p>

        {(selectedMonth || selectedCategory) && (
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
          value={`R$ ${stats.netWorth.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={PiggyBank}
          trend={{ value: `${Math.abs(stats.wealthTrend).toFixed(1)}%`, positive: stats.wealthTrend >= 0 }}
          variant="success"
        />
        <StatCard
          title="Investimentos"
          value={`R$ ${stats.totalCurrentInvestments.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingUp}
          trend={{ value: `${Math.abs(stats.investmentTrend).toFixed(1)}%`, positive: stats.investmentTrend >= 0 }}
          variant="success"
        />
        <StatCard
          title="Receitas (mês)"
          value={`R$ ${stats.currentMonthIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingUp}
          trend={{ value: `${Math.abs(stats.incomeTrend).toFixed(1)}%`, positive: stats.incomeTrend >= 0 }}
        />
        <StatCard
          title="Despesas (mês)"
          value={`R$ ${stats.currentMonthExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingDown}
          trend={{ value: `${Math.abs(stats.expenseTrend).toFixed(1)}%`, positive: stats.expenseTrend < 0 }}
          variant="destructive"
        />
      </div>

      {/* Gráfico de Evolução Patrimonial Detalhada */}
      <WealthEvolutionChart />

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fluxo de Caixa</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCashFlowMonthOffset(o => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs capitalize min-w-[120px] justify-center"
                  onClick={() => setCashFlowMonthOffset(0)}
                >
                  {format(cashFlowViewDate, "MMM yyyy", { locale: ptBR })}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCashFlowMonthOffset(o => Math.min(o + 1, 0))} disabled={cashFlowMonthOffset >= 0}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashFlowData.every(d => d.receitas === 0 && d.despesas === 0) ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Wallet className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">Nenhuma transação registrada</p>
                <p className="text-xs mt-1">no período até {format(cashFlowViewDate, "MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cashFlowData} onClick={handleMonthClick}>
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
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Gastos por Categoria</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCategoryMonthOffset(o => o - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs capitalize min-w-[120px] justify-center"
                  onClick={() => setCategoryMonthOffset(0)}
                >
                  {format(categoryViewDate, "MMM yyyy", { locale: ptBR })}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCategoryMonthOffset(o => Math.min(o + 1, 0))} disabled={categoryMonthOffset >= 0}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {categoriesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Wallet className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">Nenhuma despesa registrada</p>
                <p className="text-xs mt-1">em {format(categoryViewDate, "MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolução das Metas Financeiras */}
      {goalsData.length > 0 && (
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Evolução das Metas Financeiras</CardTitle>
                <CardDescription>Acompanhe o progresso das suas metas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {goalsData.map((goal, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{goal.name}</span>
                    {goal.concluida && (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Concluída
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {goal.progresso.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={goal.progresso} 
                  className={`h-3 ${goal.concluida ? '[&>div]:bg-success' : ''}`}
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>R$ {goal.atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span>R$ {goal.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Comparação Ano a Ano */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Comparação Ano a Ano</h3>
            <p className="text-muted-foreground mt-1">
              Visualize a evolução das suas finanças ao longo dos anos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={startYear} onValueChange={(v) => { setStartYear(v); if (parseInt(v) > parseInt(endYear)) setEndYear(v); }}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">até</span>
            <Select value={endYear} onValueChange={(v) => { setEndYear(v); if (parseInt(v) < parseInt(startYear)) setStartYear(v); }}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Receitas vs Despesas Anuais</CardTitle>
              <CardDescription>Comparação total por ano</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={filteredYearlyIncomeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="ano" className="text-xs" />
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

        {/* Cards de Estatísticas Anuais */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Crescimento Patrimonial ({new Date().getFullYear() - 1}-{new Date().getFullYear()})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${annualStats.wealthGrowth.percentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                {annualStats.wealthGrowth.percentage >= 0 ? '+' : ''}{annualStats.wealthGrowth.percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                De R$ {annualStats.wealthGrowth.from.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para R$ {annualStats.wealthGrowth.to.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Economia Média Anual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                R$ {annualStats.averageAnnualSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Baseado nos anos com dados
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de Crescimento Anual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${annualStats.averageGrowthRate >= 0 ? 'text-warning' : 'text-destructive'}`}>
                {annualStats.averageGrowthRate >= 0 ? '+' : ''}{annualStats.averageGrowthRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Média dos últimos anos
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
