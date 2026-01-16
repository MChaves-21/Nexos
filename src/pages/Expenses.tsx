import { useState, useMemo, useCallback } from "react";
import { Plus, Edit2, Trash2, Settings, Filter, X, CalendarIcon, Search, PieChart as PieChartIcon, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, CheckCircle2, Download, FileText, FileSpreadsheet } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getDaysInMonth, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "@/hooks/use-toast";
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

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
  
  // Filtro rápido por mês
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);

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

  // Aplicar filtro de mês selecionado às datas
  const effectiveDateFrom = selectedMonth ? startOfMonth(selectedMonth) : filterDateFrom;
  const effectiveDateTo = selectedMonth ? endOfMonth(selectedMonth) : filterDateTo;

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
      if (effectiveDateFrom) {
        const transactionDate = new Date(t.date);
        if (transactionDate < effectiveDateFrom) return false;
      }

      // Filtro por data final
      if (effectiveDateTo) {
        const transactionDate = new Date(t.date);
        const endOfDay = new Date(effectiveDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (transactionDate > endOfDay) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, filterType, filterCategory, effectiveDateFrom, effectiveDateTo]);

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

  // Dados para comparação mês a mês
  const monthComparisonData = useMemo(() => {
    const chartColors = [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--primary))",
      "hsl(var(--accent))",
    ];

    const referenceMonth = selectedMonth || new Date();
    const currentMonthStart = startOfMonth(referenceMonth);
    const currentMonthEnd = endOfMonth(referenceMonth);
    const previousMonthStart = startOfMonth(subMonths(referenceMonth, 1));
    const previousMonthEnd = endOfMonth(subMonths(referenceMonth, 1));

    // Filtrar despesas do mês atual (ou selecionado)
    const currentMonthExpenses = transactions.filter(t => {
      const date = new Date(t.date);
      return t.type === 'expense' && date >= currentMonthStart && date <= currentMonthEnd;
    });

    // Filtrar despesas do mês anterior
    const previousMonthExpenses = transactions.filter(t => {
      const date = new Date(t.date);
      return t.type === 'expense' && date >= previousMonthStart && date <= previousMonthEnd;
    });

    // Calcular totais por categoria
    const currentTotals: { [key: string]: number } = {};
    const previousTotals: { [key: string]: number } = {};

    currentMonthExpenses.forEach(t => {
      currentTotals[t.category] = (currentTotals[t.category] || 0) + t.amount;
    });

    previousMonthExpenses.forEach(t => {
      previousTotals[t.category] = (previousTotals[t.category] || 0) + t.amount;
    });

    // Combinar categorias
    const allCategories = [...new Set([...Object.keys(currentTotals), ...Object.keys(previousTotals)])];

    const comparisonData = allCategories.map((category, index) => {
      const current = currentTotals[category] || 0;
      const previous = previousTotals[category] || 0;
      const difference = current - previous;
      const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

      return {
        category,
        currentMonth: current,
        previousMonth: previous,
        difference,
        percentChange,
        color: chartColors[index % chartColors.length],
      };
    }).sort((a, b) => b.currentMonth - a.currentMonth);

    const currentTotal = Object.values(currentTotals).reduce((sum, val) => sum + val, 0);
    const previousTotal = Object.values(previousTotals).reduce((sum, val) => sum + val, 0);
    const totalDifference = currentTotal - previousTotal;
    const totalPercentChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : currentTotal > 0 ? 100 : 0;

    return {
      data: comparisonData,
      currentMonthLabel: format(referenceMonth, "MMM/yy", { locale: ptBR }),
      previousMonthLabel: format(subMonths(referenceMonth, 1), "MMM/yy", { locale: ptBR }),
      currentTotal,
      previousTotal,
      totalDifference,
      totalPercentChange,
    };
  }, [transactions, selectedMonth]);

  // Previsão de gastos baseada no histórico
  const expenseForecastData = useMemo(() => {
    const now = new Date();
    const currentDay = getDate(now);
    const daysInCurrentMonth = getDaysInMonth(now);
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Calcular média dos últimos 3 meses por categoria
    const last3Months = [1, 2, 3].map(i => ({
      start: startOfMonth(subMonths(now, i)),
      end: endOfMonth(subMonths(now, i)),
    }));

    // Gastos do mês atual até agora
    const currentMonthExpenses = transactions.filter(t => {
      const date = new Date(t.date);
      return t.type === 'expense' && date >= currentMonthStart && date <= now;
    });

    // Calcular totais por categoria no mês atual
    const currentTotals: { [key: string]: number } = {};
    currentMonthExpenses.forEach(t => {
      currentTotals[t.category] = (currentTotals[t.category] || 0) + t.amount;
    });

    // Calcular média histórica por categoria (últimos 3 meses)
    const historicalAverages: { [key: string]: number } = {};
    const allHistoricalCategories = new Set<string>();

    last3Months.forEach(({ start, end }) => {
      const monthExpenses = transactions.filter(t => {
        const date = new Date(t.date);
        return t.type === 'expense' && date >= start && date <= end;
      });

      monthExpenses.forEach(t => {
        allHistoricalCategories.add(t.category);
        if (!historicalAverages[t.category]) {
          historicalAverages[t.category] = 0;
        }
        historicalAverages[t.category] += t.amount / 3;
      });
    });

    // Combinar categorias atuais e históricas
    const allCategories = [...new Set([...Object.keys(currentTotals), ...allHistoricalCategories])];

    // Calcular previsão para cada categoria
    const forecasts = allCategories.map(category => {
      const currentSpent = currentTotals[category] || 0;
      const historicalAvg = historicalAverages[category] || 0;
      
      // Projetar gastos do mês atual baseado no ritmo atual
      const dailyRate = currentSpent / currentDay;
      const projectedFromRate = dailyRate * daysInCurrentMonth;
      
      // Usar média ponderada: 60% baseado no ritmo atual, 40% baseado na média histórica
      const projected = currentDay > 7 
        ? (projectedFromRate * 0.6) + (historicalAvg * 0.4)
        : historicalAvg; // Se muito cedo no mês, usar apenas média histórica

      const budget = budgets.find(b => b.category === category)?.monthly_budget || 0;
      const percentOfBudget = budget > 0 ? (projected / budget) * 100 : 0;
      const willExceedBudget = budget > 0 && projected > budget;
      const differenceFromAvg = projected - historicalAvg;
      const percentChangeFromAvg = historicalAvg > 0 
        ? ((projected - historicalAvg) / historicalAvg) * 100 
        : 0;

      return {
        category,
        currentSpent,
        projected,
        historicalAvg,
        budget,
        percentOfBudget,
        willExceedBudget,
        differenceFromAvg,
        percentChangeFromAvg,
        daysRemaining: daysInCurrentMonth - currentDay,
        suggestedDailyBudget: budget > 0 && (daysInCurrentMonth - currentDay) > 0
          ? Math.max(0, (budget - currentSpent) / (daysInCurrentMonth - currentDay))
          : 0,
      };
    }).filter(f => f.currentSpent > 0 || f.historicalAvg > 0)
      .sort((a, b) => b.projected - a.projected);

    const totalCurrentSpent = Object.values(currentTotals).reduce((sum, val) => sum + val, 0);
    const totalProjected = forecasts.reduce((sum, f) => sum + f.projected, 0);
    const totalHistoricalAvg = Object.values(historicalAverages).reduce((sum, val) => sum + val, 0);
    const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_budget, 0);
    
    return {
      forecasts,
      totalCurrentSpent,
      totalProjected,
      totalHistoricalAvg,
      totalBudget,
      daysElapsed: currentDay,
      daysRemaining: daysInCurrentMonth - currentDay,
      totalDaysInMonth: daysInCurrentMonth,
      percentMonthElapsed: (currentDay / daysInCurrentMonth) * 100,
      willExceedTotalBudget: totalBudget > 0 && totalProjected > totalBudget,
      projectedSavings: totalBudget > 0 ? totalBudget - totalProjected : 0,
    };
  }, [transactions, budgets]);

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm || filterType !== 'all' || filterCategory !== 'all' || filterDateFrom || filterDateTo || selectedMonth;

  const clearFilters = () => {
    setSearchTerm("");
    setFilterType('all');
    setFilterCategory('all');
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setSelectedMonth(null);
  };

  // Funções para navegação de mês
  const selectCurrentMonth = () => {
    setSelectedMonth(new Date());
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  const goToPreviousMonth = () => {
    setSelectedMonth(prev => prev ? subMonths(prev, 1) : subMonths(new Date(), 1));
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => prev ? addMonths(prev, 1) : addMonths(new Date(), 1));
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  const clearMonthFilter = () => {
    setSelectedMonth(null);
  };

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "Nenhuma transação",
        description: "Não há transações para exportar.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Data", "Tipo", "Descrição", "Categoria", "Valor"];
    const rows = filteredTransactions.map(t => [
      format(new Date(t.date), "dd/MM/yyyy"),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.description,
      t.category,
      t.type === 'income' 
        ? t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : `-${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ]);

    // Add summary row
    rows.push([]);
    rows.push(["", "", "", "Total Receitas", `R$ ${filteredSummary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);
    rows.push(["", "", "", "Total Despesas", `R$ ${filteredSummary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);
    rows.push(["", "", "", "Saldo", `R$ ${filteredSummary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transacoes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Exportação concluída",
      description: `${filteredTransactions.length} transações exportadas para CSV.`,
    });
  }, [filteredTransactions, filteredSummary]);

  // Export to PDF
  const exportToPDF = useCallback(() => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "Nenhuma transação",
        description: "Não há transações para exportar.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text("Relatório de Transações", 14, 22);
    
    // Period info
    doc.setFontSize(10);
    doc.setTextColor(100);
    let periodText = "Período: ";
    if (selectedMonth) {
      periodText += format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
    } else if (effectiveDateFrom || effectiveDateTo) {
      periodText += effectiveDateFrom ? format(effectiveDateFrom, "dd/MM/yyyy") : "início";
      periodText += " até ";
      periodText += effectiveDateTo ? format(effectiveDateTo, "dd/MM/yyyy") : "hoje";
    } else {
      periodText += "Todas as transações";
    }
    doc.text(periodText, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 36);

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Resumo", 14, 48);
    
    doc.setFontSize(10);
    doc.text(`Total de Transações: ${filteredTransactions.length}`, 14, 56);
    doc.setTextColor(34, 139, 34);
    doc.text(`Receitas: R$ ${filteredSummary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 62);
    doc.setTextColor(220, 53, 69);
    doc.text(`Despesas: R$ ${filteredSummary.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 68);
    doc.setTextColor(filteredSummary.balance >= 0 ? 34 : 220, filteredSummary.balance >= 0 ? 139 : 53, filteredSummary.balance >= 0 ? 34 : 69);
    doc.text(`Saldo: R$ ${filteredSummary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, 74);

    // Table
    const tableData = filteredTransactions.map(t => [
      format(new Date(t.date), "dd/MM/yyyy"),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.description.length > 30 ? t.description.substring(0, 30) + "..." : t.description,
      t.category,
      `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ]);

    autoTable(doc, {
      startY: 82,
      head: [["Data", "Tipo", "Descrição", "Categoria", "Valor"]],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 22 },
        2: { cellWidth: 60 },
        3: { cellWidth: 35 },
        4: { cellWidth: 30, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          if (data.cell.raw === 'Receita') {
            data.cell.styles.textColor = [34, 139, 34];
          } else {
            data.cell.styles.textColor = [220, 53, 69];
          }
        }
      },
    });

    doc.save(`transacoes_${format(new Date(), "yyyy-MM-dd")}.pdf`);

    toast({
      title: "Exportação concluída",
      description: `${filteredTransactions.length} transações exportadas para PDF.`,
    });
  }, [filteredTransactions, filteredSummary, selectedMonth, effectiveDateFrom, effectiveDateTo]);

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
              <div className="flex items-center gap-2 flex-wrap">
                {/* Export Buttons */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={exportToPDF}
                      >
                        <FileText className="h-4 w-4 text-destructive" />
                        Exportar PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={exportToCSV}
                      >
                        <FileSpreadsheet className="h-4 w-4 text-success" />
                        Exportar CSV
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

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
                        {[searchTerm, filterType !== 'all', filterCategory !== 'all', filterDateFrom, filterDateTo, selectedMonth].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Month Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Filtro Rápido:</span>
              </div>
              <div className="flex items-center gap-2">
                {!selectedMonth ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={selectCurrentMonth}
                    className="gap-2"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Mês Atual
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToPreviousMonth}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="px-3 py-1.5 bg-primary/10 rounded-md min-w-[140px] text-center">
                      <span className="text-sm font-medium capitalize">
                        {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={goToNextMonth}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={clearMonthFilter}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

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

          {/* Month Comparison */}
          {monthComparisonData.data.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Comparação Mês a Mês
                    </CardTitle>
                    <CardDescription>
                      {monthComparisonData.previousMonthLabel} vs {monthComparisonData.currentMonthLabel}
                    </CardDescription>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                    monthComparisonData.totalDifference > 0 
                      ? "bg-destructive/10 text-destructive" 
                      : monthComparisonData.totalDifference < 0 
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {monthComparisonData.totalDifference > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : monthComparisonData.totalDifference < 0 ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                    <span>
                      {monthComparisonData.totalDifference > 0 ? '+' : ''}
                      {monthComparisonData.totalPercentChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthComparisonData.data.slice(0, 6)}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis 
                          type="number" 
                          tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="category" 
                          width={80}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            name === 'previousMonth' ? monthComparisonData.previousMonthLabel : monthComparisonData.currentMonthLabel
                          ]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar 
                          dataKey="previousMonth" 
                          name={monthComparisonData.previousMonthLabel}
                          fill="hsl(var(--muted-foreground))" 
                          radius={[0, 4, 4, 0]}
                          barSize={12}
                        />
                        <Bar 
                          dataKey="currentMonth" 
                          name={monthComparisonData.currentMonthLabel}
                          fill="hsl(var(--primary))" 
                          radius={[0, 4, 4, 0]}
                          barSize={12}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Comparison Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{monthComparisonData.previousMonthLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">{monthComparisonData.currentMonthLabel}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                      {monthComparisonData.data.map((item) => (
                        <div 
                          key={item.category} 
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm font-medium truncate max-w-[120px]">{item.category}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              R$ {item.currentMonth.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <div className={cn(
                              "flex items-center gap-1 text-xs font-medium min-w-[60px] justify-end",
                              item.difference > 0 
                                ? "text-destructive" 
                                : item.difference < 0 
                                  ? "text-success"
                                  : "text-muted-foreground"
                            )}>
                              {item.difference > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : item.difference < 0 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : null}
                              <span>
                                {item.difference > 0 ? '+' : ''}
                                {item.percentChange.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 mt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Total</span>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">
                              {monthComparisonData.previousMonthLabel}: R$ {monthComparisonData.previousTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-sm font-bold">
                              {monthComparisonData.currentMonthLabel}: R$ {monthComparisonData.currentTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 text-sm font-bold",
                            monthComparisonData.totalDifference > 0 
                              ? "text-destructive" 
                              : monthComparisonData.totalDifference < 0 
                                ? "text-success"
                                : "text-muted-foreground"
                          )}>
                            {monthComparisonData.totalDifference > 0 ? '+' : ''}
                            R$ {Math.abs(monthComparisonData.totalDifference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expense Forecast */}
          {expenseForecastData.forecasts.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Previsão de Gastos
                    </CardTitle>
                    <CardDescription>
                      Baseado no histórico dos últimos 3 meses e ritmo atual
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{expenseForecastData.daysElapsed} dias passados</span>
                    </div>
                    <span>•</span>
                    <span>{expenseForecastData.daysRemaining} dias restantes</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress of the month */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progresso do mês</span>
                    <span className="font-medium">{expenseForecastData.percentMonthElapsed.toFixed(0)}%</span>
                  </div>
                  <Progress value={expenseForecastData.percentMonthElapsed} className="h-2" />
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Gasto Atual</p>
                    <p className="text-lg font-bold">
                      R$ {expenseForecastData.totalCurrentSpent.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className={cn(
                    "rounded-lg p-3",
                    expenseForecastData.willExceedTotalBudget ? "bg-destructive/10" : "bg-primary/10"
                  )}>
                    <p className="text-xs text-muted-foreground">Projeção do Mês</p>
                    <p className={cn(
                      "text-lg font-bold",
                      expenseForecastData.willExceedTotalBudget ? "text-destructive" : "text-primary"
                    )}>
                      R$ {expenseForecastData.totalProjected.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Média Histórica</p>
                    <p className="text-lg font-bold">
                      R$ {expenseForecastData.totalHistoricalAvg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  {expenseForecastData.totalBudget > 0 && (
                    <div className={cn(
                      "rounded-lg p-3",
                      expenseForecastData.projectedSavings >= 0 ? "bg-success/10" : "bg-destructive/10"
                    )}>
                      <p className="text-xs text-muted-foreground">
                        {expenseForecastData.projectedSavings >= 0 ? 'Economia Projetada' : 'Déficit Projetado'}
                      </p>
                      <p className={cn(
                        "text-lg font-bold",
                        expenseForecastData.projectedSavings >= 0 ? "text-success" : "text-destructive"
                      )}>
                        R$ {Math.abs(expenseForecastData.projectedSavings).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Category Forecasts */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Previsão por Categoria</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {expenseForecastData.forecasts.slice(0, 8).map((forecast) => (
                      <div 
                        key={forecast.category}
                        className="p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{forecast.category}</span>
                            {forecast.willExceedBudget && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                            {forecast.budget > 0 && !forecast.willExceedBudget && forecast.percentOfBudget < 80 && (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block">Atual</span>
                              <span className="text-sm font-semibold">
                                R$ {forecast.currentSpent.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block">Projeção</span>
                              <span className={cn(
                                "text-sm font-bold",
                                forecast.willExceedBudget ? "text-destructive" : ""
                              )}>
                                R$ {forecast.projected.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Progress bar for budget */}
                        {forecast.budget > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Orçamento: R$ {forecast.budget.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                              <span>{forecast.percentOfBudget.toFixed(0)}% projetado</span>
                            </div>
                            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                              {/* Current spending */}
                              <div 
                                className="absolute h-full bg-primary/50 rounded-full"
                                style={{ width: `${Math.min((forecast.currentSpent / forecast.budget) * 100, 100)}%` }}
                              />
                              {/* Projected spending indicator */}
                              <div 
                                className={cn(
                                  "absolute h-full w-0.5",
                                  forecast.willExceedBudget ? "bg-destructive" : "bg-primary"
                                )}
                                style={{ left: `${Math.min(forecast.percentOfBudget, 100)}%` }}
                              />
                            </div>
                            {forecast.suggestedDailyBudget > 0 && forecast.daysRemaining > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                💡 Sugestão: gaste até R$ {forecast.suggestedDailyBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por dia
                              </p>
                            )}
                            {forecast.willExceedBudget && (
                              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Projeção excede o orçamento em R$ {(forecast.projected - forecast.budget).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Historical comparison */}
                        {forecast.historicalAvg > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">vs média:</span>
                            <span className={cn(
                              "flex items-center gap-1 font-medium",
                              forecast.differenceFromAvg > 0 ? "text-destructive" : forecast.differenceFromAvg < 0 ? "text-success" : "text-muted-foreground"
                            )}>
                              {forecast.differenceFromAvg > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : forecast.differenceFromAvg < 0 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}
                              {forecast.differenceFromAvg > 0 ? '+' : ''}
                              {forecast.percentChangeFromAvg.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
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
