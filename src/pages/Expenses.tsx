import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Settings, Filter, X, CalendarIcon, Search, PieChart as PieChartIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { TransactionRowSkeleton, BudgetCardSkeleton } from "@/components/skeletons";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const Expenses = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: 'expense' as 'income' | 'expense',
    description: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [budgetFormData, setBudgetFormData] = useState({
    category: '',
    monthly_budget: '',
  });

  // Filtros avançados
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);

  const { transactions, isLoading, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { budgets, isLoading: isBudgetsLoading, upsertBudget, deleteBudget } = useBudgets();

  const handleSubmit = () => {
    if (!formData.description || !formData.category || !formData.amount) {
      return;
    }

    addTransaction({
      type: formData.type,
      description: formData.description,
      category: formData.category,
      amount: parseFloat(formData.amount),
      date: formData.date,
    });

    setFormData({
      type: 'expense',
      description: '',
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(false);
  };

  const handleEdit = (transaction: typeof transactions[0]) => {
    setEditingTransaction(transaction.id);
    setFormData({
      type: transaction.type,
      description: transaction.description,
      category: transaction.category,
      amount: transaction.amount.toString(),
      date: transaction.date,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingTransaction || !formData.description || !formData.category || !formData.amount) {
      return;
    }

    updateTransaction({
      id: editingTransaction,
      type: formData.type,
      description: formData.description,
      category: formData.category,
      amount: parseFloat(formData.amount),
      date: formData.date,
    });

    setFormData({
      type: 'expense',
      description: '',
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
    });
    setEditingTransaction(null);
    setIsEditDialogOpen(false);
  };

  const handleBudgetEdit = (category: string, currentBudget: number) => {
    setEditingBudgetCategory(category);
    setBudgetFormData({
      category,
      monthly_budget: currentBudget.toString(),
    });
    setIsBudgetDialogOpen(true);
  };

  const handleBudgetSubmit = () => {
    if (!budgetFormData.category || !budgetFormData.monthly_budget) {
      return;
    }

    upsertBudget.mutate({
      category: budgetFormData.category,
      monthly_budget: parseFloat(budgetFormData.monthly_budget),
    });

    setBudgetFormData({
      category: '',
      monthly_budget: '',
    });
    setEditingBudgetCategory(null);
    setIsBudgetDialogOpen(false);
  };

  // Get current month spending by category
  const getCurrentMonthSpending = (category: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return (
          t.type === 'expense' &&
          t.category === category &&
          transactionDate.getMonth() === currentMonth &&
          transactionDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Get all unique categories from transactions and budgets
  const allCategories = useMemo(() => {
    const transactionCategories = [...new Set(transactions.filter(t => t.type === 'expense').map(t => t.category))];
    const budgetCategories = budgets.map(b => b.category);
    return [...new Set([...transactionCategories, ...budgetCategories])].sort();
  }, [transactions, budgets]);

  // Get all unique categories from ALL transactions (including income)
  const allTransactionCategories = useMemo(() => {
    return [...new Set(transactions.map(t => t.category))].sort();
  }, [transactions]);

  // Filtrar transações
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Filtro por termo de busca
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesDescription = t.description.toLowerCase().includes(search);
        const matchesCategory = t.category.toLowerCase().includes(search);
        if (!matchesDescription && !matchesCategory) return false;
      }

      // Filtro por tipo
      if (filterType !== 'all' && t.type !== filterType) return false;

      // Filtro por categoria
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;

      // Filtro por data inicial
      if (filterDateFrom) {
        const transactionDate = new Date(t.date);
        if (transactionDate < filterDateFrom) return false;
      }

      // Filtro por data final
      if (filterDateTo) {
        const transactionDate = new Date(t.date);
        const endOfDay = new Date(filterDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (transactionDate > endOfDay) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterDateFrom, filterDateTo]);

  // Resumo das transações filtradas
  const filteredSummary = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense, count: filteredTransactions.length };
  }, [filteredTransactions]);

  // Dados para o gráfico de pizza (despesas por categoria)
  const expensesByCategoryData = useMemo(() => {
    const chartColors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--primary))",
      "hsl(var(--accent))",
    ];

    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const categoryTotals: { [key: string]: number } = {};

    expenses.forEach(t => {
      if (!categoryTotals[t.category]) {
        categoryTotals[t.category] = 0;
      }
      categoryTotals[t.category] += t.amount;
    });

    const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

    return Object.entries(categoryTotals)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: total > 0 ? (value / total * 100).toFixed(1) : 0,
        color: chartColors[index % chartColors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm || filterType !== 'all' || filterCategory !== 'all' || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setSearchTerm("");
    setFilterType('all');
    setFilterCategory('all');
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  // Build categories data with real spending and budgets
  const categoriesData = useMemo(() => {
    const chartColors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
    ];

    return allCategories.map((category, index) => {
      const budget = budgets.find(b => b.category === category);
      const spent = getCurrentMonthSpending(category);
      
      return {
        name: category,
        spent,
        budget: budget?.monthly_budget || 0,
        budgetId: budget?.id,
        color: chartColors[index % chartColors.length],
      };
    });
  }, [allCategories, budgets, transactions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gastos e Receitas</h2>
          <p className="text-muted-foreground mt-1">
            Controle seu fluxo de caixa mensal
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Transação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input 
                  id="description" 
                  placeholder="Ex: Aluguel" 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                <SelectContent>
                  {allCategories.length > 0 ? (
                    allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Moradia">Moradia</SelectItem>
                      <SelectItem value="Alimentação">Alimentação</SelectItem>
                      <SelectItem value="Transporte">Transporte</SelectItem>
                      <SelectItem value="Lazer">Lazer</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </>
                  )}
                </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input 
                  id="date" 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Progress */}
      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Orçamento por Categoria</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setBudgetFormData({ category: '', monthly_budget: '' });
                setEditingBudgetCategory(null);
                setIsBudgetDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {isBudgetsLoading ? (
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <BudgetCardSkeleton key={i} />
                ))}
              </div>
            ) : categoriesData.length === 0 ? (
              <p className="text-center text-muted-foreground">
                Nenhum orçamento definido. Clique em "Novo Orçamento" para começar.
              </p>
            ) : (
              categoriesData.map((category) => {
                const percentage = category.budget > 0 ? (category.spent / category.budget) * 100 : 0;
                const isOverBudget = percentage > 100;
                const isNearLimit = percentage >= 80 && percentage <= 100;
                
                return (
                  <div key={category.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{category.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleBudgetEdit(category.name, category.budget)}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className={isOverBudget ? "text-destructive" : "text-muted-foreground"}>
                        R$ {category.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {category.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className="h-2"
                      style={{
                        // @ts-ignore
                        "--progress-background": isOverBudget ? "hsl(var(--destructive))" : category.color
                      }}
                    />
                    {isOverBudget && (
                      <p className="text-xs text-destructive">
                        Você excedeu o orçamento em R$ {(category.spent - category.budget).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {isNearLimit && !isOverBudget && (
                      <p className="text-xs text-warning">
                        Você está próximo do limite ({percentage.toFixed(0)}%)
                      </p>
                    )}
                    {category.budget === 0 && category.spent > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum orçamento definido para esta categoria
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions with Filters */}
      <Card>
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Transações</CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                    <X className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button 
                    variant={hasActiveFilters ? "default" : "outline"} 
                    size="sm" 
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filtros
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {[searchTerm, filterType !== 'all', filterCategory !== 'all', filterDateFrom, filterDateTo].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters Collapsible */}
            <CollapsibleContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descrição ou categoria..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Type Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={filterType} onValueChange={(value: 'all' | 'income' | 'expense') => setFilterType(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="income">Receitas</SelectItem>
                        <SelectItem value="expense">Despesas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category Filter */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Categoria</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {allTransactionCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date From */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Data Início</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !filterDateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filterDateFrom ? format(filterDateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filterDateFrom}
                          onSelect={setFilterDateFrom}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Date To */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Data Fim</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !filterDateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filterDateTo ? format(filterDateTo, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filterDateTo}
                          onSelect={setFilterDateTo}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </CollapsibleContent>

          {/* Summary of filtered transactions */}
          {hasActiveFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Transações</p>
                <p className="text-lg font-bold">{filteredSummary.count}</p>
              </div>
              <div className="bg-success/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Receitas</p>
                <p className="text-lg font-bold text-success">
                  +R$ {filteredSummary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold text-destructive">
                  -R$ {filteredSummary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className={cn("rounded-lg p-3", filteredSummary.balance >= 0 ? "bg-success/10" : "bg-destructive/10")}>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className={cn("text-lg font-bold", filteredSummary.balance >= 0 ? "text-success" : "text-destructive")}>
                  {filteredSummary.balance >= 0 ? '+' : ''}R$ {filteredSummary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {/* Pie Chart - Expenses by Category */}
          {expensesByCategoryData.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  Distribuição de Despesas por Categoria
                </CardTitle>
                <CardDescription>
                  {hasActiveFilters ? 'Período filtrado' : 'Todas as transações'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expensesByCategoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {expensesByCategoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [
                            `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            'Valor'
                          ]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Detalhamento</p>
                    {expensesByCategoryData.map((category, index) => (
                      <div key={category.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-sm font-medium">{category.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold">
                            R$ {category.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({category.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Total</span>
                        <span className="text-sm font-bold text-destructive">
                          R$ {filteredSummary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions List */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <TransactionRowSkeleton key={i} />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {hasActiveFilters ? 'Nenhuma transação encontrada com os filtros aplicados' : 'Nenhuma transação encontrada'}
              </p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{transaction.description}</p>
                      <Badge variant="outline" className="text-xs">
                        {transaction.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(transaction.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-semibold ${
                        transaction.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'} R${' '}
                      {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => deleteTransaction(transaction)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Collapsible>
      </Card>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}>
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Input 
                id="edit-description" 
                placeholder="Ex: Aluguel" 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Categoria</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Valor</Label>
              <Input 
                id="edit-amount" 
                type="number" 
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Data</Label>
              <Input 
                id="edit-date" 
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={handleUpdate}>Atualizar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Edit Dialog */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudgetCategory ? 'Editar Orçamento' : 'Novo Orçamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="budget-category">Categoria</Label>
              {editingBudgetCategory ? (
                <Input 
                  id="budget-category" 
                  value={budgetFormData.category}
                  disabled
                />
              ) : (
                <Input 
                  id="budget-category" 
                  placeholder="Ex: Moradia, Alimentação, Transporte" 
                  value={budgetFormData.category}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, category: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-amount">Orçamento Mensal (R$)</Label>
              <Input 
                id="budget-amount" 
                type="number" 
                placeholder="0.00"
                value={budgetFormData.monthly_budget}
                onChange={(e) => setBudgetFormData({ ...budgetFormData, monthly_budget: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleBudgetSubmit}>
                {editingBudgetCategory ? 'Atualizar' : 'Salvar'}
              </Button>
              {editingBudgetCategory && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    const budget = budgets.find(b => b.category === editingBudgetCategory);
                    if (budget) {
                      deleteBudget.mutate(budget);
                      setIsBudgetDialogOpen(false);
                      setEditingBudgetCategory(null);
                    }
                  }}
                >
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Expenses;
