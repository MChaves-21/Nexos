import { useState, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2, Calendar, Target, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import { useInvestments } from "@/hooks/useInvestments";
import { useAllocationTargets } from "@/hooks/useAllocationTargets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Progress } from "@/components/ui/progress";

const Investments = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    asset_type: '',
    asset_name: '',
    quantity: '',
    purchase_price: '',
    current_price: '',
    purchase_date: new Date().toISOString().split('T')[0],
  });

  const { investments, isLoading, addInvestment, updateInvestment, deleteInvestment } = useInvestments();
  const { allocationTargets, upsertAllocationTarget } = useAllocationTargets();
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [targetFormData, setTargetFormData] = useState({ asset_type: '', target_percentage: '' });

  // Get available years from investments
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    investments.forEach(inv => {
      const year = new Date(inv.purchase_date).getFullYear();
      years.add(year);
    });
    if (years.size === 0) {
      years.add(new Date().getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [investments]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedAssetType, setSelectedAssetType] = useState<string>("all");

  // Calculate monthly returns based on investments
  const performanceData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Initialize all months with zero
    const monthlyData = months.map(mes => ({ mes, rendimento: 0 }));
    
    // Calculate returns for each investment in the selected year
    investments.forEach(inv => {
      const purchaseDate = new Date(inv.purchase_date);
      const purchaseYear = purchaseDate.getFullYear();
      const purchaseMonth = purchaseDate.getMonth();
      
      if (purchaseYear === selectedYear) {
        // Calculate the gain for this investment
        const gain = (inv.current_price - inv.purchase_price) * inv.quantity;
        
        // Add to the purchase month
        monthlyData[purchaseMonth].rendimento += gain;
      }
    });

    // Round values
    return monthlyData.map(d => ({
      ...d,
      rendimento: Math.round(d.rendimento * 100) / 100
    }));
  }, [investments, selectedYear]);

  // Get unique asset types for filter
  const assetTypes = useMemo(() => {
    const types = new Set<string>();
    investments.forEach(inv => types.add(inv.asset_type));
    return Array.from(types).sort();
  }, [investments]);

  // Calculate accumulated evolution over time
  const accumulatedEvolutionData = useMemo(() => {
    if (investments.length === 0) return [];

    // Filter by asset type if selected
    const filteredInvestments = selectedAssetType === "all" 
      ? investments 
      : investments.filter(inv => inv.asset_type === selectedAssetType);

    if (filteredInvestments.length === 0) return [];

    // Sort investments by purchase date
    const sortedInvestments = [...filteredInvestments].sort(
      (a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
    );

    // Group by month-year and accumulate
    const monthlyAccumulated: { [key: string]: { invested: number; current: number } } = {};
    let totalInvested = 0;
    let totalCurrent = 0;

    sortedInvestments.forEach(inv => {
      const date = new Date(inv.purchase_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      totalInvested += inv.purchase_price * inv.quantity;
      totalCurrent += inv.current_price * inv.quantity;

      monthlyAccumulated[monthKey] = {
        invested: totalInvested,
        current: totalCurrent
      };
    });

    // Convert to array and format for chart
    return Object.entries(monthlyAccumulated)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, values]) => {
        const [year, month] = key.split('-');
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return {
          periodo: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
          investido: Math.round(values.invested * 100) / 100,
          atual: Math.round(values.current * 100) / 100
        };
      });
  }, [investments, selectedAssetType]);

  // Calculate portfolio distribution by asset type
  const portfolioDistribution = useMemo(() => {
    if (investments.length === 0) return [];

    const COLORS = [
      'hsl(var(--primary))',
      'hsl(var(--success))',
      'hsl(var(--warning))',
      'hsl(var(--destructive))',
      'hsl(var(--secondary))',
      'hsl(215 70% 50%)',
      'hsl(280 70% 50%)',
    ];

    const distribution: { [key: string]: number } = {};
    let totalValue = 0;

    investments.forEach(inv => {
      const currentValue = inv.current_price * inv.quantity;
      totalValue += currentValue;
      if (!distribution[inv.asset_type]) {
        distribution[inv.asset_type] = 0;
      }
      distribution[inv.asset_type] += currentValue;
    });

    return Object.entries(distribution).map(([name, value], index) => ({
      name,
      value: Math.round(value * 100) / 100,
      percentage: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : '0.0',
      color: COLORS[index % COLORS.length]
    }));
  }, [investments]);

  // Calculate allocation comparison (current vs target)
  const allocationComparison = useMemo(() => {
    const assetTypesList = ["Ações", "FIIs", "Tesouro Direto", "Renda Fixa", "Criptomoedas"];
    
    // Calculate current percentages
    let totalValue = 0;
    const currentDistribution: { [key: string]: number } = {};
    
    investments.forEach(inv => {
      const currentValue = inv.current_price * inv.quantity;
      totalValue += currentValue;
      if (!currentDistribution[inv.asset_type]) {
        currentDistribution[inv.asset_type] = 0;
      }
      currentDistribution[inv.asset_type] += currentValue;
    });

    // Create target map
    const targetMap: { [key: string]: number } = {};
    allocationTargets.forEach(t => {
      targetMap[t.asset_type] = t.target_percentage;
    });

      return assetTypesList.map(type => ({
      type,
      current: totalValue > 0 ? parseFloat(((currentDistribution[type] || 0) / totalValue * 100).toFixed(1)) : 0,
      target: targetMap[type] || 0,
      currentValue: currentDistribution[type] || 0,
      difference: totalValue > 0 
        ? parseFloat(((currentDistribution[type] || 0) / totalValue * 100).toFixed(1)) - (targetMap[type] || 0)
        : 0 - (targetMap[type] || 0)
    }));
  }, [investments, allocationTargets]);

  // Calculate rebalancing suggestions
  const rebalancingSuggestions = useMemo(() => {
    const totalValue = investments.reduce((sum, inv) => sum + inv.current_price * inv.quantity, 0);
    if (totalValue === 0 || allocationTargets.length === 0) return [];

    const suggestions: {
      type: string;
      action: 'buy' | 'sell';
      amount: number;
      percentage: number;
      priority: 'high' | 'medium' | 'low';
    }[] = [];

    allocationComparison.forEach(item => {
      if (item.target === 0) return; // Skip if no target set

      const difference = item.difference;
      const targetValue = (item.target / 100) * totalValue;
      const amountDiff = Math.abs(targetValue - item.currentValue);

      // Only suggest if difference is significant (> 2%)
      if (Math.abs(difference) > 2) {
        const priority: 'high' | 'medium' | 'low' = 
          Math.abs(difference) > 10 ? 'high' : 
          Math.abs(difference) > 5 ? 'medium' : 'low';

        suggestions.push({
          type: item.type,
          action: difference > 0 ? 'sell' : 'buy',
          amount: amountDiff,
          percentage: Math.abs(difference),
          priority
        });
      }
    });

    // Sort by priority and percentage difference
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.percentage - a.percentage;
    });
  }, [investments, allocationTargets, allocationComparison]);

  const handleSaveTarget = () => {
    if (!targetFormData.asset_type || !targetFormData.target_percentage) return;
    
    upsertAllocationTarget({
      asset_type: targetFormData.asset_type,
      target_percentage: parseFloat(targetFormData.target_percentage)
    });
    
    setTargetFormData({ asset_type: '', target_percentage: '' });
    setIsTargetDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.asset_name || !formData.asset_type || !formData.quantity || !formData.purchase_price || !formData.current_price) {
      return;
    }

    addInvestment({
      asset_name: formData.asset_name,
      asset_type: formData.asset_type,
      quantity: parseFloat(formData.quantity),
      purchase_price: parseFloat(formData.purchase_price),
      current_price: parseFloat(formData.current_price),
      purchase_date: formData.purchase_date,
    });

    setFormData({
      asset_type: '',
      asset_name: '',
      quantity: '',
      purchase_price: '',
      current_price: '',
      purchase_date: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(false);
  };

  const handleEdit = (investment: typeof investments[0]) => {
    setEditingInvestment(investment.id);
    setFormData({
      asset_type: investment.asset_type,
      asset_name: investment.asset_name,
      quantity: investment.quantity.toString(),
      purchase_price: investment.purchase_price.toString(),
      current_price: investment.current_price.toString(),
      purchase_date: investment.purchase_date,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingInvestment || !formData.asset_name || !formData.asset_type || !formData.quantity || !formData.purchase_price || !formData.current_price) {
      return;
    }

    updateInvestment({
      id: editingInvestment,
      asset_name: formData.asset_name,
      asset_type: formData.asset_type,
      quantity: parseFloat(formData.quantity),
      purchase_price: parseFloat(formData.purchase_price),
      current_price: parseFloat(formData.current_price),
      purchase_date: formData.purchase_date,
    });

    setFormData({
      asset_type: '',
      asset_name: '',
      quantity: '',
      purchase_price: '',
      current_price: '',
      purchase_date: new Date().toISOString().split('T')[0],
    });
    setEditingInvestment(null);
    setIsEditDialogOpen(false);
  };

  const totalInvested = investments.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0);
  const totalCurrent = investments.reduce((sum, item) => sum + (item.current_price * item.quantity), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPercentage = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(2) : '0.00';

  const calculateGain = (item: typeof investments[0]) => {
    const invested = item.purchase_price * item.quantity;
    const current = item.current_price * item.quantity;
    const gain = current - invested;
    const percentage = invested > 0 ? ((gain / invested) * 100).toFixed(2) : '0.00';
    return { gain, percentage };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Investimentos</h2>
          <p className="text-muted-foreground mt-1">
            Acompanhe sua carteira de investimentos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Ativo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Investimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="asset-type">Tipo de Ativo</Label>
                <Select value={formData.asset_type} onValueChange={(value) => setFormData({ ...formData, asset_type: value })}>
                  <SelectTrigger id="asset-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ações">Ações</SelectItem>
                    <SelectItem value="FIIs">FIIs</SelectItem>
                    <SelectItem value="Tesouro Direto">Tesouro Direto</SelectItem>
                    <SelectItem value="Renda Fixa">Renda Fixa</SelectItem>
                    <SelectItem value="Criptomoedas">Criptomoedas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-name">Nome/Ticker</Label>
                <Input 
                  id="asset-name" 
                  placeholder="Ex: PETR4, HGLG11"
                  value={formData.asset_name}
                  onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input 
                  id="quantity" 
                  type="number" 
                  placeholder="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avg-price">Preço de Compra</Label>
                <Input 
                  id="avg-price" 
                  type="number" 
                  placeholder="0.00"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current-price">Preço Atual</Label>
                <Input 
                  id="current-price" 
                  type="number" 
                  placeholder="0.00"
                  value={formData.current_price}
                  onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-date">Data da Compra</Label>
                <Input 
                  id="purchase-date" 
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Investido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className={totalGain >= 0 ? "border-success/20" : "border-destructive/20"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ganho Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {totalGain.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className={`text-xs mt-1 ${totalGain >= 0 ? 'text-success' : 'text-destructive'}`}>
              {totalGain >= 0 ? '+' : ''}{totalGainPercentage}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rendimentos Mensais</CardTitle>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)"
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Rendimento']}
              />
              <Bar dataKey="rendimento" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Portfolio Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição da Carteira</CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioDistribution.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Adicione investimentos para ver a distribuição
            </p>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={portfolioDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    labelLine={false}
                  >
                    {portfolioDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                  />
                  <Legend 
                    formatter={(value, entry: any) => (
                      <span className="text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocation Targets */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Metas de Alocação
          </CardTitle>
          <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Definir Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Definir Meta de Alocação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="target-asset-type">Tipo de Ativo</Label>
                  <Select 
                    value={targetFormData.asset_type} 
                    onValueChange={(value) => setTargetFormData({ ...targetFormData, asset_type: value })}
                  >
                    <SelectTrigger id="target-asset-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ações">Ações</SelectItem>
                      <SelectItem value="FIIs">FIIs</SelectItem>
                      <SelectItem value="Tesouro Direto">Tesouro Direto</SelectItem>
                      <SelectItem value="Renda Fixa">Renda Fixa</SelectItem>
                      <SelectItem value="Criptomoedas">Criptomoedas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-percentage">Percentual Meta (%)</Label>
                  <Input 
                    id="target-percentage" 
                    type="number" 
                    placeholder="Ex: 30"
                    min="0"
                    max="100"
                    value={targetFormData.target_percentage}
                    onChange={(e) => setTargetFormData({ ...targetFormData, target_percentage: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleSaveTarget}>Salvar Meta</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allocationComparison.map((item) => {
              const hasTarget = item.target > 0;
              const isOverAllocated = item.difference > 0;
              const isUnderAllocated = item.difference < 0;
              
              return (
                <div key={item.type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.type}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        Atual: <span className="text-foreground font-medium">{item.current}%</span>
                      </span>
                      {hasTarget && (
                        <>
                          <span className="text-muted-foreground">
                            Meta: <span className="text-foreground font-medium">{item.target}%</span>
                          </span>
                          <span className={`text-xs font-medium ${isOverAllocated ? 'text-warning' : isUnderAllocated ? 'text-destructive' : 'text-success'}`}>
                            {item.difference > 0 ? '+' : ''}{item.difference.toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(item.current, 100)}%` }}
                    />
                    {hasTarget && (
                      <div 
                        className="absolute h-full w-0.5 bg-foreground"
                        style={{ left: `${Math.min(item.target, 100)}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rebalancing Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Sugestões de Rebalanceamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allocationTargets.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Defina metas de alocação para receber sugestões de rebalanceamento
            </p>
          ) : rebalancingSuggestions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-success font-medium">✓ Carteira balanceada!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sua alocação está alinhada com suas metas
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rebalancingSuggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    suggestion.priority === 'high' 
                      ? 'border-destructive/50 bg-destructive/5' 
                      : suggestion.priority === 'medium'
                      ? 'border-warning/50 bg-warning/5'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      suggestion.action === 'buy' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {suggestion.action === 'buy' ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {suggestion.action === 'buy' ? 'Comprar' : 'Vender'} {suggestion.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Diferença de {suggestion.percentage.toFixed(1)}% da meta
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      R$ {suggestion.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <Badge 
                      variant={
                        suggestion.priority === 'high' ? 'destructive' : 
                        suggestion.priority === 'medium' ? 'secondary' : 'outline'
                      }
                      className="text-xs"
                    >
                      {suggestion.priority === 'high' ? 'Alta' : 
                       suggestion.priority === 'medium' ? 'Média' : 'Baixa'} prioridade
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Evolução Acumulada dos Investimentos</CardTitle>
          <Select 
            value={selectedAssetType} 
            onValueChange={setSelectedAssetType}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo de Ativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {assetTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {accumulatedEvolutionData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Adicione investimentos para ver a evolução acumulada
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={accumulatedEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="periodo" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)"
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                />
                <Area 
                  type="monotone" 
                  dataKey="investido" 
                  stroke="hsl(var(--muted-foreground))" 
                  fill="hsl(var(--muted))" 
                  name="Total Investido"
                />
                <Area 
                  type="monotone" 
                  dataKey="atual" 
                  stroke="hsl(var(--success))" 
                  fill="hsl(var(--success)/0.3)" 
                  name="Valor Atual"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Table */}
      <Card>
        <CardHeader>
          <CardTitle>Minha Carteira</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : investments.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum investimento encontrado</p>
          ) : (
            <div className="space-y-4">
              {investments.map((item) => {
                const { gain, percentage } = calculateGain(item);
                const isPositive = gain >= 0;
                const totalValue = item.current_price * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{item.asset_name}</p>
                        <Badge variant="outline" className="text-xs">
                          {item.asset_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.quantity} × R$ {item.current_price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">
                          R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3 text-success" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-destructive" />
                          )}
                          <span className={`text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                            {isPositive ? '+' : ''}{percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => deleteInvestment(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Investment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Investimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-asset-type">Tipo de Ativo</Label>
              <Select value={formData.asset_type} onValueChange={(value) => setFormData({ ...formData, asset_type: value })}>
                <SelectTrigger id="edit-asset-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ações">Ações</SelectItem>
                  <SelectItem value="FIIs">FIIs</SelectItem>
                  <SelectItem value="Tesouro Direto">Tesouro Direto</SelectItem>
                  <SelectItem value="Renda Fixa">Renda Fixa</SelectItem>
                  <SelectItem value="Criptomoedas">Criptomoedas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-asset-name">Nome/Ticker</Label>
              <Input 
                id="edit-asset-name" 
                placeholder="Ex: PETR4, HGLG11"
                value={formData.asset_name}
                onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantidade</Label>
              <Input 
                id="edit-quantity" 
                type="number" 
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-avg-price">Preço de Compra</Label>
              <Input 
                id="edit-avg-price" 
                type="number" 
                placeholder="0.00"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-current-price">Preço Atual</Label>
              <Input 
                id="edit-current-price" 
                type="number" 
                placeholder="0.00"
                value={formData.current_price}
                onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purchase-date">Data da Compra</Label>
              <Input 
                id="edit-purchase-date" 
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={handleUpdate}>Atualizar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Investments;
