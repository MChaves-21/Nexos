import { useState, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2, Calendar } from "lucide-react";
import { useInvestments } from "@/hooks/useInvestments";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";

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

  // Calculate accumulated evolution over time
  const accumulatedEvolutionData = useMemo(() => {
    if (investments.length === 0) return [];

    // Sort investments by purchase date
    const sortedInvestments = [...investments].sort(
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
  }, [investments]);

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

      {/* Accumulated Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução Acumulada dos Investimentos</CardTitle>
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
