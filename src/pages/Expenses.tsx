import { useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
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

  // Mock data
  const categories = [
    { name: "Moradia", spent: 2000, budget: 2500, color: "hsl(var(--chart-1))" },
    { name: "Alimentação", spent: 1200, budget: 1500, color: "hsl(var(--chart-2))" },
    { name: "Transporte", spent: 800, budget: 1000, color: "hsl(var(--chart-3))" },
    { name: "Lazer", spent: 600, budget: 800, color: "hsl(var(--chart-4))" },
    { name: "Outros", spent: 700, budget: 1000, color: "hsl(var(--chart-5))" },
  ];

  const recentTransactions = [
    { id: 1, description: "Aluguel", category: "Moradia", amount: 2000, date: "2024-06-01", type: "expense" },
    { id: 2, description: "Salário", category: "Receita", amount: 8700, date: "2024-06-05", type: "income" },
    { id: 3, description: "Supermercado", category: "Alimentação", amount: 450, date: "2024-06-08", type: "expense" },
    { id: 4, description: "Uber", category: "Transporte", amount: 120, date: "2024-06-10", type: "expense" },
    { id: 5, description: "Cinema", category: "Lazer", amount: 80, date: "2024-06-12", type: "expense" },
  ];

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
                <Select>
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
                <Input id="description" placeholder="Ex: Aluguel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moradia">Moradia</SelectItem>
                    <SelectItem value="alimentacao">Alimentação</SelectItem>
                    <SelectItem value="transporte">Transporte</SelectItem>
                    <SelectItem value="lazer">Lazer</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input id="amount" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input id="date" type="date" />
              </div>
              <Button className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Progress */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Orçamento por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {categories.map((category) => {
              const percentage = (category.spent / category.budget) * 100;
              const isOverBudget = percentage > 100;
              
              return (
                <div key={category.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{category.name}</span>
                    <span className={isOverBudget ? "text-destructive" : "text-muted-foreground"}>
                      R$ {category.spent.toLocaleString()} / R$ {category.budget.toLocaleString()}
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
                      Você excedeu o orçamento em R$ {(category.spent - category.budget).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Transações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTransactions.map((transaction) => (
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
                    {transaction.amount.toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Expenses;
