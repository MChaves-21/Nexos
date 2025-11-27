import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useGoals = () => {
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("financial_goals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Goal[];
    },
  });

  const addGoal = useMutation({
    mutationFn: async (newGoal: Omit<Goal, "id" | "user_id" | "created_at" | "updated_at" | "completed" | "completed_at">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("financial_goals")
        .insert([{ ...newGoal, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast({
        title: "Meta criada",
        description: "Sua meta financeira foi criada com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Goal> & { id: string }) => {
      const { data, error } = await supabase
        .from("financial_goals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      
      // Check if goal was just completed
      if (data.completed && !data.completed_at) {
        toast({
          title: "🎉 Meta alcançada!",
          description: `Parabéns! Você atingiu a meta "${data.title}"!`,
          duration: 5000,
        });
      } else {
        toast({
          title: "Meta atualizada",
          description: "Sua meta foi atualizada com sucesso!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_goals")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast({
        title: "Meta excluída",
        description: "Sua meta foi excluída com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir meta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    goals,
    isLoading,
    addGoal,
    updateGoal,
    deleteGoal,
  };
};