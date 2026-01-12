import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUndoableDelete } from "./useUndoableDelete";

export interface CategoryBudget {
  id: string;
  user_id: string;
  category: string;
  monthly_budget: number;
  created_at: string;
  updated_at: string;
}

export const useBudgets = () => {
  const queryClient = useQueryClient();

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["category_budgets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("category_budgets")
        .select("*")
        .order("category");

      if (error) throw error;
      return data as CategoryBudget[];
    },
  });

  const upsertBudget = useMutation({
    mutationFn: async (budget: { category: string; monthly_budget: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("category_budgets")
        .upsert({ 
          user_id: user.id,
          category: budget.category,
          monthly_budget: budget.monthly_budget 
        }, {
          onConflict: 'user_id,category'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_budgets"] });
      toast({
        title: "Orçamento atualizado",
        description: "O orçamento da categoria foi atualizado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar orçamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { deleteWithUndo } = useUndoableDelete<CategoryBudget>({
    tableName: "category_budgets",
    queryKey: ["category_budgets"],
    itemLabel: "Orçamento",
    getItemDescription: (budget) => budget.category,
  });

  return {
    budgets,
    isLoading,
    upsertBudget,
    deleteBudget: { mutate: deleteWithUndo },
  };
};