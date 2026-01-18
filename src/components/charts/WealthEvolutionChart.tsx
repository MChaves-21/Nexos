import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Calendar, Sparkles, Target, X, Check, CalendarClock } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useInvestments } from "@/hooks/useInvestments";
import { CurrencyInput } from "@/components/ui/currency-input";

type TimeRange = "6m" | "1y" | "2y" | "all";
type ScenarioType = "base" | "optimistic" | "conservative" | "pessimistic";

const SCENARIO_CONFIG = {
  base: { label: "Base", color: "chart-3", multiplier: 1 },
  optimistic: { label: "Otimista", color: "success", multiplier: 1.5 },
  conservative: { label: "Conservador", color: "warning", multiplier: 0.6 },
  pessimistic: { label: "Pessimista", color: "destructive", multiplier: 0.2 }
};

const WEALTH_GOAL_KEY = 'nexos-wealth-goal';

const WealthEvolutionChart = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [showProjection, setShowProjection] = useState(true);
  const [activeScenarios, setActiveScenarios] = useState<ScenarioType[]>(["base"]);
  const [wealthGoal, setWealthGoal] = useState<number | null>(null);
  const [goalInputValue, setGoalInputValue] = useState("");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const { transactions, isLoading: loadingTransactions } = useTransactions();
  const { investments, isLoading: loadingInvestments } = useInvestments();

  const toggleScenario = (scenario: ScenarioType) => {
    setActiveScenarios(prev => {
      if (prev.includes(scenario)) {
        // Ensure at least one scenario is always active
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== scenario);
      }
      return [...prev, scenario];
    });
  };

  // Carregar meta do localStorage
  useEffect(() => {
    const savedGoal = localStorage.getItem(WEALTH_GOAL_KEY);
    if (savedGoal) {
      const parsed = parseFloat(savedGoal);
      if (!isNaN(parsed) && parsed > 0) {
        setWealthGoal(parsed);
        setGoalInputValue(parsed.toString());
      }
    }
  }, []);

  const handleSaveGoal = () => {
    // CurrencyInput retorna valor já parseado (ex: "1000.50")
    const value = parseFloat(goalInputValue);
    if (!isNaN(value) && value > 0) {
      setWealthGoal(value);
      localStorage.setItem(WEALTH_GOAL_KEY, value.toString());
      setIsEditingGoal(false);
    }
  };

  const handleRemoveGoal = () => {
    setWealthGoal(null);
    setGoalInputValue("");
    localStorage.removeItem(WEALTH_GOAL_KEY);
    setIsEditingGoal(false);
  };

  const chartData = useMemo(() => {
    if (loadingTransactions || loadingInvestments) return null;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Determinar quantidade de meses baseado no período selecionado
    const monthsToShow = timeRange === "6m" ? 6 : timeRange === "1y" ? 12 : timeRange === "2y" ? 24 : 36;

    // Criar lista de meses históricos
    const months: { month: number; year: number; name: string; fullName: string }[] = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        name: monthNames[date.getMonth()],
        fullName: `${monthNames[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`
      });
    }

    // Agrupar transações por mês
    const monthlyData: { [key: string]: { income: number; expense: number } } = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }
      
      if (transaction.type === 'income') {
        monthlyData[monthKey].income += transaction.amount;
      } else {
        monthlyData[monthKey].expense += transaction.amount;
      }
    });

    // Calcular valor inicial dos investimentos para cada mês
    const getInvestmentValueAtMonth = (targetMonth: number, targetYear: number) => {
      return investments.reduce((total, inv) => {
        const purchaseDate = new Date(inv.purchase_date);
        const purchaseMonth = purchaseDate.getMonth();
        const purchaseYear = purchaseDate.getFullYear();
        
        // Se o investimento foi comprado antes ou durante este mês
        if (purchaseYear < targetYear || (purchaseYear === targetYear && purchaseMonth <= targetMonth)) {
          return total + (inv.current_price * inv.quantity);
        }
        return total;
      }, 0);
    };

    // Calcular patrimônio acumulado
    let cumulativeSavings = 0;
    
    // Calcular economia acumulada antes do período de exibição
    const allTransactionsSorted = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsToShow);
    
    allTransactionsSorted.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      if (transactionDate < startDate) {
        if (transaction.type === 'income') {
          cumulativeSavings += transaction.amount;
        } else {
          cumulativeSavings -= transaction.amount;
        }
      }
    });

    const historicalData = months.map(({ month, year, fullName }) => {
      const key = `${year}-${month}`;
      const monthData = monthlyData[key] || { income: 0, expense: 0 };
      
      cumulativeSavings += monthData.income - monthData.expense;
      const investmentValue = getInvestmentValueAtMonth(month, year);
      const totalWealth = Math.max(0, cumulativeSavings) + investmentValue;

      return {
        name: fullName,
        patrimonio: totalWealth,
        economias: Math.max(0, cumulativeSavings),
        investimentos: investmentValue,
        receitas: monthData.income,
        despesas: monthData.expense,
        saldo: monthData.income - monthData.expense,
        isProjection: false,
        projecaoPatrimonio: null as number | null,
        projecaoInvestimentos: null as number | null
      };
    });

    // Calcular estatísticas históricas
    const firstValue = historicalData[0]?.patrimonio || 0;
    const lastValue = historicalData[historicalData.length - 1]?.patrimonio || 0;
    const absoluteChange = lastValue - firstValue;
    const percentageChange = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    const maxValue = Math.max(...historicalData.map(d => d.patrimonio));
    const minValue = Math.min(...historicalData.map(d => d.patrimonio));
    const avgValue = historicalData.reduce((sum, d) => sum + d.patrimonio, 0) / historicalData.length;

    // Calcular taxa média de crescimento mensal
    const monthlyGrowthRates: number[] = [];
    for (let i = 1; i < historicalData.length; i++) {
      const prevValue = historicalData[i - 1].patrimonio;
      const currValue = historicalData[i].patrimonio;
      if (prevValue > 0) {
        const rate = (currValue - prevValue) / prevValue;
        monthlyGrowthRates.push(rate);
      }
    }
    
    const avgMonthlyGrowthRate = monthlyGrowthRates.length > 0
      ? monthlyGrowthRates.reduce((sum, rate) => sum + rate, 0) / monthlyGrowthRates.length
      : 0.02; // Default 2% ao mês se não houver dados

    // Calcular aporte médio mensal
    const avgMonthlySavings = historicalData.reduce((sum, d) => sum + d.saldo, 0) / historicalData.length;

    // Gerar projeção futura (próximos 12 meses) para cada cenário
    const projectionMonths = 12;
    const scenarios: ScenarioType[] = ["base", "optimistic", "conservative", "pessimistic"];
    
    const projectionData: (typeof historicalData[0] & {
      projecaoOtimista?: number | null;
      projecaoConservadora?: number | null;
      projecaoPessimista?: number | null;
    })[] = [];

    // Valores iniciais para cada cenário
    const scenarioValues = {
      base: lastValue,
      optimistic: lastValue,
      conservative: lastValue,
      pessimistic: lastValue
    };

    for (let i = 1; i <= projectionMonths; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const fullName = `${monthNames[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      
      // Calcular projeção para cada cenário
      scenarios.forEach(scenario => {
        const multiplier = SCENARIO_CONFIG[scenario].multiplier;
        const adjustedGrowthRate = avgMonthlyGrowthRate * multiplier;
        const adjustedSavings = Math.max(0, avgMonthlySavings) * multiplier;
        scenarioValues[scenario] = scenarioValues[scenario] * (1 + adjustedGrowthRate) + adjustedSavings;
      });

      projectionData.push({
        name: fullName,
        patrimonio: 0,
        economias: 0,
        investimentos: 0,
        receitas: 0,
        despesas: 0,
        saldo: 0,
        isProjection: true,
        projecaoPatrimonio: Math.round(scenarioValues.base),
        projecaoInvestimentos: null,
        projecaoOtimista: Math.round(scenarioValues.optimistic),
        projecaoConservadora: Math.round(scenarioValues.conservative),
        projecaoPessimista: Math.round(scenarioValues.pessimistic)
      });
    }

    // Adicionar ponto de transição (último ponto histórico também na projeção)
    const transitionPoint = {
      ...historicalData[historicalData.length - 1],
      projecaoPatrimonio: historicalData[historicalData.length - 1].patrimonio,
      projecaoInvestimentos: historicalData[historicalData.length - 1].investimentos,
      projecaoOtimista: historicalData[historicalData.length - 1].patrimonio,
      projecaoConservadora: historicalData[historicalData.length - 1].patrimonio,
      projecaoPessimista: historicalData[historicalData.length - 1].patrimonio
    };

    // Combinar dados históricos e projeção
    const combinedData = [
      ...historicalData.slice(0, -1).map(d => ({
        ...d,
        projecaoOtimista: null as number | null,
        projecaoConservadora: null as number | null,
        projecaoPessimista: null as number | null
      })),
      transitionPoint,
      ...projectionData
    ];

    // Estatísticas finais de cada cenário
    const scenarioFinalValues = {
      base: projectionData[projectionData.length - 1]?.projecaoPatrimonio || lastValue,
      optimistic: projectionData[projectionData.length - 1]?.projecaoOtimista || lastValue,
      conservative: projectionData[projectionData.length - 1]?.projecaoConservadora || lastValue,
      pessimistic: projectionData[projectionData.length - 1]?.projecaoPessimista || lastValue
    };

    // Estatísticas de projeção
    const projectedFinalValue = scenarioFinalValues.base;
    const projectedGrowth = lastValue > 0 ? ((projectedFinalValue - lastValue) / lastValue) * 100 : 0;

    return {
      data: combinedData,
      historicalData: historicalData.map(d => ({
        ...d,
        projecaoOtimista: null as number | null,
        projecaoConservadora: null as number | null,
        projecaoPessimista: null as number | null
      })),
      stats: {
        currentValue: lastValue,
        absoluteChange,
        percentageChange,
        maxValue,
        minValue,
        avgValue,
        isPositive: percentageChange >= 0,
        avgMonthlyGrowthRate: avgMonthlyGrowthRate * 100,
        avgMonthlySavings
      },
      projection: {
        finalValue: projectedFinalValue,
        growth: projectedGrowth,
        monthsAhead: projectionMonths
      },
      scenarioFinalValues
    };
  }, [transactions, investments, loadingTransactions, loadingInvestments, timeRange]);

  if (loadingTransactions || loadingInvestments || !chartData) {
    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle>Evolução Patrimonial Detalhada</CardTitle>
          <CardDescription>Carregando dados...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const { data, historicalData, stats, projection, scenarioFinalValues } = chartData;
  const displayData = showProjection ? data : historicalData;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Calcular estimativa de quando a meta será atingida
  const goalEstimate = useMemo(() => {
    if (!wealthGoal || stats.currentValue >= wealthGoal) {
      return null;
    }

    const monthlyGrowthRate = stats.avgMonthlyGrowthRate / 100; // Converter de porcentagem
    const monthlySavings = Math.max(0, stats.avgMonthlySavings);
    
    // Se taxa de crescimento é muito baixa ou negativa e não há aportes significativos
    if (monthlyGrowthRate <= 0 && monthlySavings <= 0) {
      return { months: null, reachable: false, estimatedDate: null };
    }

    // Simulação mês a mês para encontrar quando atinge a meta
    let currentValue = stats.currentValue;
    let months = 0;
    const maxMonths = 360; // Limite de 30 anos

    while (currentValue < wealthGoal && months < maxMonths) {
      currentValue = currentValue * (1 + monthlyGrowthRate) + monthlySavings;
      months++;
    }

    if (months >= maxMonths) {
      return { months: null, reachable: false, estimatedDate: null };
    }

    // Calcular data estimada
    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + months);

    return {
      months,
      reachable: true,
      estimatedDate,
      years: Math.floor(months / 12),
      remainingMonths: months % 12
    };
  }, [wealthGoal, stats.currentValue, stats.avgMonthlyGrowthRate, stats.avgMonthlySavings]);

  const formatEstimatedDate = (date: Date) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const tooltipData = payload[0].payload;
      const isProjection = tooltipData.isProjection;
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-foreground">{label}</p>
            {isProjection && (
              <Badge variant="outline" className="text-xs bg-chart-3/20 text-chart-3 border-chart-3/50">
                <Sparkles className="h-3 w-3 mr-1" />
                Projeção
              </Badge>
            )}
          </div>
          <div className="space-y-1 text-sm">
            {isProjection ? (
              <>
                {activeScenarios.includes("base") && tooltipData.projecaoPatrimonio != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Base:</span>
                    <span className="font-medium text-chart-3">{formatCurrency(tooltipData.projecaoPatrimonio)}</span>
                  </div>
                )}
                {activeScenarios.includes("optimistic") && tooltipData.projecaoOtimista != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Otimista:</span>
                    <span className="font-medium text-success">{formatCurrency(tooltipData.projecaoOtimista)}</span>
                  </div>
                )}
                {activeScenarios.includes("conservative") && tooltipData.projecaoConservadora != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Conservador:</span>
                    <span className="font-medium text-warning">{formatCurrency(tooltipData.projecaoConservadora)}</span>
                  </div>
                )}
                {activeScenarios.includes("pessimistic") && tooltipData.projecaoPessimista != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Pessimista:</span>
                    <span className="font-medium text-destructive">{formatCurrency(tooltipData.projecaoPessimista)}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  * Taxa base: {stats.avgMonthlyGrowthRate.toFixed(1)}%/mês
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Patrimônio Total:</span>
                  <span className="font-medium text-primary">{formatCurrency(tooltipData.patrimonio)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Economias:</span>
                  <span className="font-medium">{formatCurrency(tooltipData.economias)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Investimentos:</span>
                  <span className="font-medium">{formatCurrency(tooltipData.investimentos)}</span>
                </div>
                <div className="border-t border-border pt-1 mt-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-success">Receitas:</span>
                    <span className="font-medium text-success">+{formatCurrency(tooltipData.receitas)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-destructive">Despesas:</span>
                    <span className="font-medium text-destructive">-{formatCurrency(tooltipData.despesas)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Evolução Patrimonial Detalhada
            </CardTitle>
            <CardDescription>Acompanhe o crescimento do seu patrimônio ao longo do tempo</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-projection"
                checked={showProjection}
                onCheckedChange={setShowProjection}
              />
              <Label htmlFor="show-projection" className="text-sm flex items-center gap-1 cursor-pointer">
                <Sparkles className="h-4 w-4 text-chart-3" />
                Projeção
              </Label>
            </div>
            <div className="flex gap-1">
              {(["6m", "1y", "2y", "all"] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range === "6m" ? "6M" : range === "1y" ? "1A" : range === "2y" ? "2A" : "Tudo"}
                </Button>
              ))}
            </div>
            
            {/* Wealth Goal Control */}
            <Popover open={isEditingGoal} onOpenChange={setIsEditingGoal}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Target className="h-4 w-4 text-warning" />
                  {wealthGoal ? 'Meta' : 'Definir Meta'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-warning" />
                    <p className="font-semibold text-sm">Meta de Patrimônio</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Defina uma meta para visualizar no gráfico e acompanhar seu progresso.
                  </p>
                  <div className="flex gap-2">
                    <CurrencyInput
                      placeholder="Ex: 100.000"
                      value={goalInputValue}
                      onChange={(value) => setGoalInputValue(value)}
                      className="flex-1"
                    />
                    <Button size="icon" onClick={handleSaveGoal} className="shrink-0">
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                  {wealthGoal && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleRemoveGoal} 
                      className="w-full text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remover Meta
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Patrimônio Atual</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(stats.currentValue)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Variação no Período</p>
            <div className="flex items-center gap-1">
              {stats.isPositive ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={`text-lg font-bold ${stats.isPositive ? 'text-success' : 'text-destructive'}`}>
                {stats.percentageChange >= 0 ? '+' : ''}{stats.percentageChange.toFixed(1)}%
              </span>
            </div>
          </div>
          {showProjection ? (
            <>
              <div className="bg-chart-3/10 rounded-lg p-3 border border-chart-3/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-chart-3" />
                  Base 12 meses
                </p>
                <p className="text-lg font-bold text-chart-3">{formatCurrency(scenarioFinalValues.base)}</p>
              </div>
              <div className="bg-success/10 rounded-lg p-3 border border-success/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  Otimista
                </p>
                <p className="text-lg font-bold text-success">{formatCurrency(scenarioFinalValues.optimistic)}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Máximo no Período</p>
                <p className="text-lg font-bold">{formatCurrency(stats.maxValue)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Média no Período</p>
                <p className="text-lg font-bold">{formatCurrency(stats.avgValue)}</p>
              </div>
            </>
          )}
        </div>

        {/* Scenario Toggle Buttons */}
        {showProjection && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-muted-foreground mr-2 self-center">Cenários:</span>
            {(Object.keys(SCENARIO_CONFIG) as ScenarioType[]).map((scenario) => {
              const config = SCENARIO_CONFIG[scenario];
              const isActive = activeScenarios.includes(scenario);
              return (
                <Button
                  key={scenario}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleScenario(scenario)}
                  className={isActive ? `bg-${config.color} hover:bg-${config.color}/90` : ""}
                  style={isActive ? {
                    backgroundColor: `hsl(var(--${config.color}))`,
                    color: config.color === 'warning' ? 'hsl(var(--foreground))' : undefined
                  } : undefined}
                >
                  {config.label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={displayData}>
            <defs>
              <linearGradient id="colorPatrimonio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorInvestimentos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProjecaoBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProjecaoOtimista" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProjecaoConservadora" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorProjecaoPessimista" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="name" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              className="text-xs"
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={stats.avgValue} 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5"
              label={{ value: 'Média', position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="investimentos"
              stroke="hsl(var(--chart-2))"
              fill="url(#colorInvestimentos)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="patrimonio"
              stroke="hsl(var(--primary))"
              fill="url(#colorPatrimonio)"
              strokeWidth={2}
            />
            {/* Cenário Pessimista */}
            {showProjection && activeScenarios.includes("pessimistic") && (
              <Area
                type="monotone"
                dataKey="projecaoPessimista"
                stroke="hsl(var(--destructive))"
                fill="url(#colorProjecaoPessimista)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {/* Cenário Conservador */}
            {showProjection && activeScenarios.includes("conservative") && (
              <Area
                type="monotone"
                dataKey="projecaoConservadora"
                stroke="hsl(var(--warning))"
                fill="url(#colorProjecaoConservadora)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {/* Cenário Base */}
            {showProjection && activeScenarios.includes("base") && (
              <Area
                type="monotone"
                dataKey="projecaoPatrimonio"
                stroke="hsl(var(--chart-3))"
                fill="url(#colorProjecaoBase)"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}
            {/* Cenário Otimista */}
            {showProjection && activeScenarios.includes("optimistic") && (
              <Area
                type="monotone"
                dataKey="projecaoOtimista"
                stroke="hsl(var(--success))"
                fill="url(#colorProjecaoOtimista)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
            {wealthGoal && (
              <ReferenceLine 
                y={wealthGoal} 
                stroke="hsl(var(--warning))" 
                strokeWidth={2}
                strokeDasharray="8 4"
                label={{ 
                  value: `Meta: ${formatCurrency(wealthGoal)}`, 
                  position: 'insideTopLeft', 
                  fill: 'hsl(var(--warning))', 
                  fontSize: 12,
                  fontWeight: 'bold'
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex justify-center flex-wrap gap-4 md:gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            <span className="text-sm text-muted-foreground">Patrimônio Total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
            <span className="text-sm text-muted-foreground">Investimentos</span>
          </div>
          {showProjection && activeScenarios.includes("base") && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: 'hsl(var(--chart-3))' }} />
              <span className="text-sm text-muted-foreground">Base ({stats.avgMonthlyGrowthRate.toFixed(1)}%/mês)</span>
            </div>
          )}
          {showProjection && activeScenarios.includes("optimistic") && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: 'hsl(var(--success))' }} />
              <span className="text-sm text-muted-foreground">Otimista ({(stats.avgMonthlyGrowthRate * 1.5).toFixed(1)}%/mês)</span>
            </div>
          )}
          {showProjection && activeScenarios.includes("conservative") && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: 'hsl(var(--warning))' }} />
              <span className="text-sm text-muted-foreground">Conservador ({(stats.avgMonthlyGrowthRate * 0.6).toFixed(1)}%/mês)</span>
            </div>
          )}
          {showProjection && activeScenarios.includes("pessimistic") && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: 'hsl(var(--destructive))' }} />
              <span className="text-sm text-muted-foreground">Pessimista ({(stats.avgMonthlyGrowthRate * 0.2).toFixed(1)}%/mês)</span>
            </div>
          )}
          {wealthGoal && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: 'hsl(var(--warning))', width: '12px' }} />
              <span className="text-sm text-muted-foreground">Meta de Patrimônio</span>
            </div>
          )}
        </div>

        {/* Goal Progress Card */}
        {wealthGoal && (
          <div className="mt-4 p-4 bg-warning/10 rounded-lg border border-warning/20">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-warning" />
                <div>
                  <p className="font-semibold text-sm">Meta: {formatCurrency(wealthGoal)}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.currentValue >= wealthGoal 
                      ? 'Parabéns! Você atingiu sua meta!' 
                      : `Faltam ${formatCurrency(wealthGoal - stats.currentValue)} para atingir`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Progresso</p>
                  <p className="text-lg font-bold text-warning">
                    {Math.min(100, (stats.currentValue / wealthGoal * 100)).toFixed(1)}%
                  </p>
                </div>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-warning rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (stats.currentValue / wealthGoal * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Estimativa de quando atinge a meta */}
            {goalEstimate && stats.currentValue < wealthGoal && (
              <div className="mt-3 pt-3 border-t border-warning/20">
                {goalEstimate.reachable && goalEstimate.estimatedDate ? (
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-accent" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Estimativa: {formatEstimatedDate(goalEstimate.estimatedDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Em aproximadamente{' '}
                          {goalEstimate.years > 0 && (
                            <span className="font-medium">{goalEstimate.years} {goalEstimate.years === 1 ? 'ano' : 'anos'}</span>
                          )}
                          {goalEstimate.years > 0 && goalEstimate.remainingMonths > 0 && ' e '}
                          {goalEstimate.remainingMonths > 0 && (
                            <span className="font-medium">{goalEstimate.remainingMonths} {goalEstimate.remainingMonths === 1 ? 'mês' : 'meses'}</span>
                          )}
                          {goalEstimate.years === 0 && goalEstimate.remainingMonths === 0 && (
                            <span className="font-medium">menos de 1 mês</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Taxa: {stats.avgMonthlyGrowthRate.toFixed(1)}%/mês
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Com a taxa de crescimento atual, a meta não será atingida em tempo hábil. 
                      Considere aumentar seus aportes mensais.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Growth Badge */}
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {stats.absoluteChange !== 0 && (
            <Badge 
              variant={stats.isPositive ? "default" : "destructive"}
              className={stats.isPositive ? "bg-success text-success-foreground" : ""}
            >
              {stats.isPositive ? '+' : ''}{formatCurrency(stats.absoluteChange)} no período
            </Badge>
          )}
          {showProjection && (
            <Badge variant="outline" className="bg-chart-3/10 text-chart-3 border-chart-3/30">
              <Sparkles className="h-3 w-3 mr-1" />
              +{formatCurrency(projection.finalValue - stats.currentValue)} em 12 meses
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WealthEvolutionChart;
