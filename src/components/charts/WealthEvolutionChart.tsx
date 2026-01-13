import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Calendar, Sparkles, Target, Pencil, X, Check } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useInvestments } from "@/hooks/useInvestments";

type TimeRange = "6m" | "1y" | "2y" | "all";

const WEALTH_GOAL_KEY = 'nexos-wealth-goal';

const WealthEvolutionChart = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [showProjection, setShowProjection] = useState(true);
  const [wealthGoal, setWealthGoal] = useState<number | null>(null);
  const [goalInputValue, setGoalInputValue] = useState("");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const { transactions, isLoading: loadingTransactions } = useTransactions();
  const { investments, isLoading: loadingInvestments } = useInvestments();

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
    const value = parseFloat(goalInputValue.replace(/[^\d.]/g, ''));
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

    // Gerar projeção futura (próximos 12 meses)
    const projectionMonths = 12;
    const projectionData: typeof historicalData = [];
    let projectedWealth = lastValue;
    let projectedInvestments = historicalData[historicalData.length - 1]?.investimentos || 0;

    for (let i = 1; i <= projectionMonths; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const fullName = `${monthNames[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;
      
      // Projeção considera crescimento + aporte médio
      projectedWealth = projectedWealth * (1 + avgMonthlyGrowthRate) + Math.max(0, avgMonthlySavings);
      projectedInvestments = projectedInvestments * (1 + avgMonthlyGrowthRate * 0.5); // Investimentos crescem mais conservadoramente

      projectionData.push({
        name: fullName,
        patrimonio: 0,
        economias: 0,
        investimentos: 0,
        receitas: 0,
        despesas: 0,
        saldo: 0,
        isProjection: true,
        projecaoPatrimonio: Math.round(projectedWealth),
        projecaoInvestimentos: Math.round(projectedInvestments)
      });
    }

    // Adicionar ponto de transição (último ponto histórico também na projeção)
    const transitionPoint = {
      ...historicalData[historicalData.length - 1],
      projecaoPatrimonio: historicalData[historicalData.length - 1].patrimonio,
      projecaoInvestimentos: historicalData[historicalData.length - 1].investimentos
    };

    // Combinar dados históricos e projeção
    const combinedData = [
      ...historicalData.slice(0, -1),
      transitionPoint,
      ...projectionData
    ];

    // Estatísticas de projeção
    const projectedFinalValue = projectionData[projectionData.length - 1]?.projecaoPatrimonio || lastValue;
    const projectedGrowth = lastValue > 0 ? ((projectedFinalValue - lastValue) / lastValue) * 100 : 0;

    return {
      data: combinedData,
      historicalData,
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
      }
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

  const { data, historicalData, stats, projection } = chartData;
  const displayData = showProjection ? data : historicalData;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const tooltipData = payload[0].payload;
      const isProjection = tooltipData.isProjection;
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
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
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Patrimônio Projetado:</span>
                  <span className="font-medium text-chart-3">{formatCurrency(tooltipData.projecaoPatrimonio)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Investimentos Projetados:</span>
                  <span className="font-medium">{formatCurrency(tooltipData.projecaoInvestimentos)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  * Baseado na taxa média de crescimento de {stats.avgMonthlyGrowthRate.toFixed(1)}%/mês
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
                    <Input
                      type="text"
                      placeholder="Ex: 100000"
                      value={goalInputValue}
                      onChange={(e) => setGoalInputValue(e.target.value)}
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
                  Projeção 12 meses
                </p>
                <p className="text-lg font-bold text-chart-3">{formatCurrency(projection.finalValue)}</p>
              </div>
              <div className="bg-chart-3/10 rounded-lg p-3 border border-chart-3/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-chart-3" />
                  Crescimento Projetado
                </p>
                <p className="text-lg font-bold text-chart-3">+{projection.growth.toFixed(1)}%</p>
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
              <linearGradient id="colorProjecao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
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
            {showProjection && (
              <>
                <Area
                  type="monotone"
                  dataKey="projecaoPatrimonio"
                  stroke="hsl(var(--chart-3))"
                  fill="url(#colorProjecao)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </>
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
          {showProjection && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: 'hsl(var(--chart-3))' }} />
              <span className="text-sm text-muted-foreground">Projeção ({stats.avgMonthlyGrowthRate.toFixed(1)}%/mês)</span>
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
            {showProjection && stats.currentValue < wealthGoal && projection.finalValue >= wealthGoal && (
              <div className="mt-3 pt-3 border-t border-warning/20">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-chart-3" />
                  Com base na projeção, você atingirá sua meta em aproximadamente 12 meses!
                </p>
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
