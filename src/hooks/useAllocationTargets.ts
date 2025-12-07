import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AllocationTarget {
  id: string;
  user_id: string;
  asset_type: string;
  target_percentage: number;
  created_at: string;
  updated_at: string;
}

export const useAllocationTargets = () => {
  const queryClient = useQueryClient();

  const { data: allocationTargets = [], isLoading } = useQuery({
    queryKey: ['allocation-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allocation_targets')
        .select('*')
        .order('asset_type', { ascending: true });

      if (error) throw error;
      return data as AllocationTarget[];
    },
  });

  const upsertAllocationTarget = useMutation({
    mutationFn: async (target: { asset_type: string; target_percentage: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('allocation_targets')
        .upsert({
          user_id: user.id,
          asset_type: target.asset_type,
          target_percentage: target.target_percentage,
        }, {
          onConflict: 'user_id,asset_type'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-targets'] });
      toast({
        title: "Meta salva",
        description: "A meta de alocação foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível salvar a meta: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteAllocationTarget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('allocation_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocation-targets'] });
      toast({
        title: "Meta removida",
        description: "A meta de alocação foi removida com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível remover a meta: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    allocationTargets,
    isLoading,
    upsertAllocationTarget: upsertAllocationTarget.mutate,
    deleteAllocationTarget: deleteAllocationTarget.mutate,
  };
};
