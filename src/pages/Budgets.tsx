import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wallet, Edit2, Trash2, AlertCircle, TrendingUp } from "lucide-react";
import { useBudgets } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Budgets = () => {
  const { budgets, isLoading: loadingBudgets, upsertBudget, deleteBudget } = useBudgets();
  const { transactions, isLoading: loadingTransactions } = useTransactions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{ category: string; monthly_budget: number } | null>(null);
  
  const [formData, setFormData] = useState({
    category: "",
    monthly_budget: "",
  });

  // Calculate current month spending by category
  const getCurrentMonthSpending = (category: string) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter(t => {
        const transactionDate = new Date(t.date);
        return (
          t.type === "expense" &&
          t.category === category &&
          transactionDate.getMonth() === currentMonth &&
          transactionDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Get all unique categories from transactions
  const allCategories = Array.from(new Set(transactions.map(t => t.category))).sort();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertBudget.mutate({
      category: formData.category,
      monthly_budget: parseFloat(formData.monthly_budget),
    });
    setFormData({ category: "", monthly_budget: "" });
    setEditingBudget(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (budget: { category: string; monthly_budget: number }) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      monthly_budget: budget.monthly_budget.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este orçamento?")) {
      deleteBudget.mutate(id);
    }
  };

  if (loadingBudgets || loadingTransactions) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Carregando orçamentos...</div>
      </div>
    );
  }

  // Calculate budget usage stats
  const budgetStats = budgets.map(budget => {
    const spent = getCurrentMonthSpending(budget.category);
    const percentage = (spent / budget.monthly_budget) * 100;
    const remaining = budget.monthly_budget - spent;
    return { ...budget, spent, percentage, remaining };
  });

  const totalBudget = budgets.reduce((sum, b) => sum + b.monthly_budget, 0);
  const totalSpent = budgetStats.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" />
            Orçamentos por Categoria
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie seus orçamentos mensais por categoria
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingBudget(null); setFormData({ category: "", monthly_budget: "" }); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Editar Orçamento" : "Criar Novo Orçamento"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="category">Categoria</Label>
                {editingBudget ? (
                  <Input
                    id="category"
                    value={formData.category}
                    disabled
                  />
                ) : (
                  <>
                    <Input
                      id="category"
                      list="categories"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Digite ou selecione uma categoria"
                      required
                    />
                    <datalist id="categories">
                      {allCategories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </>
                )}
              </div>
              <div>
                <Label htmlFor="monthly_budget">Orçamento Mensal (R$)</Label>
                <Input
                  id="monthly_budget"
                  type="number"
                  step="0.01"
                  value={formData.monthly_budget}
                  onChange={(e) => setFormData({ ...formData, monthly_budget: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingBudget ? "Salvar Alterações" : "Criar Orçamento"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orçamento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gasto Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Restante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-success' : 'text-destructive'}`}>
              R$ {totalRemaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum orçamento definido</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando orçamentos para suas categorias de gastos
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Orçamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgetStats.map((budget) => {
            const isOverBudget = budget.percentage > 100;
            const isNearLimit = budget.percentage > 80 && budget.percentage <= 100;

            return (
              <Card key={budget.id} className={`${isOverBudget ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {budget.category}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Orçamento mensal
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit({ category: budget.category, monthly_budget: budget.monthly_budget })}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(budget.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gasto</span>
                      <span className={`font-semibold ${isOverBudget ? 'text-destructive' : ''}`}>
                        {budget.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(budget.percentage, 100)} 
                      className={`h-2 ${isOverBudget ? '[&>div]:bg-destructive' : ''}`}
                    />
                    <div className="flex justify-between text-sm font-medium">
                      <span className={isOverBudget ? 'text-destructive' : 'text-primary'}>
                        R$ {budget.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-muted-foreground">
                        R$ {budget.monthly_budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {isOverBudget && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Excedeu em R$ {Math.abs(budget.remaining).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </AlertDescription>
                    </Alert>
                  )}

                  {isNearLimit && !isOverBudget && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Próximo do limite. Restam R$ {budget.remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isOverBudget && !isNearLimit && (
                    <div className="flex items-center gap-2 text-sm text-success">
                      <TrendingUp className="h-4 w-4" />
                      <span>
                        Restam R$ {budget.remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Budgets;