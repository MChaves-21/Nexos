import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Settings } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets } from "@/hooks/useBudgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
              <p className="text-center text-muted-foreground">Carregando...</p>
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

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhuma transação encontrada</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
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
                        onClick={() => deleteTransaction(transaction.id)}
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
                      deleteBudget.mutate(budget.id);
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
