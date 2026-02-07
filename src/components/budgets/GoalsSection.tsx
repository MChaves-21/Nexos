import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Target, Edit2, Trash2, Calendar, TrendingUp } from "lucide-react";
import { useGoals, Goal } from "@/hooks/useGoals";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GoalCardSkeleton } from "@/components/skeletons";
import { AnimatedListContainer, AnimatedItem } from "@/components/AnimatedList";
import { CurrencyInput } from "@/components/ui/currency-input";

const GoalsSection = () => {
  const { goals, isLoading, addGoal, updateGoal, deleteGoal } = useGoals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal.mutate({
      title: formData.title,
      description: formData.description || null,
      target_amount: parseFloat(formData.target_amount),
      current_amount: parseFloat(formData.current_amount),
      deadline: formData.deadline || null,
      category: null,
    });
    setFormData({
      title: "",
      description: "",
      target_amount: "",
      current_amount: "0",
      deadline: "",
    });
    setIsDialogOpen(false);
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || "",
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      deadline: goal.deadline || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;

    const newCurrentAmount = parseFloat(formData.current_amount);
    const targetAmount = parseFloat(formData.target_amount);
    const wasCompleted = editingGoal.completed;
    const isNowCompleted = newCurrentAmount >= targetAmount;

    updateGoal.mutate({
      id: editingGoal.id,
      title: formData.title,
      description: formData.description || null,
      target_amount: targetAmount,
      current_amount: newCurrentAmount,
      deadline: formData.deadline || null,
      category: null,
      completed: isNowCompleted,
      completed_at: isNowCompleted && !wasCompleted ? new Date().toISOString() : editingGoal.completed_at,
    });
    
    setEditingGoal(null);
    setFormData({
      title: "",
      description: "",
      target_amount: "",
      current_amount: "0",
      deadline: "",
    });
    setIsEditDialogOpen(false);
  };

  const handleDelete = (goal: Goal) => {
    deleteGoal.mutate(goal);
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <GoalCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Nova Meta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Título da Meta</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Viagem para Europa"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva sua meta..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_amount">Valor Alvo (R$)</Label>
                  <CurrencyInput
                    id="target_amount"
                    value={formData.target_amount}
                    onChange={(value) => setFormData({ ...formData, target_amount: value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="current_amount">Valor Atual (R$)</Label>
                  <CurrencyInput
                    id="current_amount"
                    value={formData.current_amount}
                    onChange={(value) => setFormData({ ...formData, current_amount: value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="deadline">Data Limite (opcional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                Criar Meta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhuma meta criada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando sua primeira meta financeira
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AnimatedListContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = calculateProgress(goal.current_amount, goal.target_amount);
            const daysRemaining = getDaysRemaining(goal.deadline);
            const isOverdue = daysRemaining !== null && daysRemaining < 0;
            const isCompleted = goal.completed;

            return (
              <AnimatedItem key={goal.id} itemKey={goal.id}>
                <Card className={`h-full ${isCompleted ? 'border-success/40 bg-success/5' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {isCompleted && <span className="text-success">✓</span>}
                          {goal.title}
                        </CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(goal)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(goal)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-semibold">{progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-primary">
                          R$ {goal.current_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-muted-foreground">
                          R$ {goal.target_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t space-y-2">
                      {goal.deadline && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className={isOverdue ? 'text-destructive' : 'text-muted-foreground'}>
                            {daysRemaining !== null && daysRemaining >= 0
                              ? `${daysRemaining} dias restantes`
                              : `Atrasado há ${Math.abs(daysRemaining!)} dias`}
                          </span>
                        </div>
                      )}
                      {isCompleted && goal.completed_at && (
                        <div className="flex items-center gap-2 text-sm text-success">
                          <TrendingUp className="h-4 w-4" />
                          <span>
                            Completada em {format(new Date(goal.completed_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedItem>
            );
          })}
        </AnimatedListContainer>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Meta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Título da Meta</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-target">Valor Alvo (R$)</Label>
                <CurrencyInput
                  id="edit-target"
                  value={formData.target_amount}
                  onChange={(value) => setFormData({ ...formData, target_amount: value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-current">Valor Atual (R$)</Label>
                <CurrencyInput
                  id="edit-current"
                  value={formData.current_amount}
                  onChange={(value) => setFormData({ ...formData, current_amount: value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-deadline">Data Limite</Label>
              <Input
                id="edit-deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Salvar Alterações
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoalsSection;
