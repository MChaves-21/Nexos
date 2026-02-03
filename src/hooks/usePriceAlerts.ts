import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PriceAlertSettings {
  id: string;
  user_id: string;
  global_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface AssetAlertThreshold {
  id: string;
  user_id: string;
  investment_id: string;
  threshold: number;
  created_at: string;
  updated_at: string;
}

export interface PriceChange {
  investment_id: string;
  asset_name: string;
  asset_type: string;
  old_price: number;
  new_price: number;
  change_percentage: number;
  threshold: number;
}

export const usePriceAlerts = () => {
  const queryClient = useQueryClient();

  // Fetch global alert settings
  const { data: alertSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['price-alert-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_alert_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as PriceAlertSettings | null;
    },
  });

  // Fetch asset-specific thresholds
  const { data: assetThresholds = [], isLoading: isLoadingThresholds } = useQuery({
    queryKey: ['asset-alert-thresholds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_alert_thresholds')
        .select('*');

      if (error) throw error;
      return data as AssetAlertThreshold[];
    },
  });

  // Upsert global settings
  const upsertSettings = useMutation({
    mutationFn: async (threshold: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('price_alert_settings')
        .upsert({
          user_id: user.id,
          global_threshold: threshold,
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-alert-settings'] });
      toast({
        title: "Configuração salva",
        description: "O limite de alerta global foi atualizado.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível salvar a configuração: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Upsert asset-specific threshold
  const upsertAssetThreshold = useMutation({
    mutationFn: async ({ investment_id, threshold }: { investment_id: string; threshold: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('asset_alert_thresholds')
        .upsert({
          user_id: user.id,
          investment_id,
          threshold,
        }, { onConflict: 'user_id,investment_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-alert-thresholds'] });
      toast({
        title: "Limite personalizado salvo",
        description: "O limite de alerta para este ativo foi atualizado.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível salvar o limite: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete asset-specific threshold
  const deleteAssetThreshold = useMutation({
    mutationFn: async (investment_id: string) => {
      const { error } = await supabase
        .from('asset_alert_thresholds')
        .delete()
        .eq('investment_id', investment_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-alert-thresholds'] });
      toast({
        title: "Limite removido",
        description: "O limite personalizado foi removido. Será usado o limite global.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Não foi possível remover o limite: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Get threshold for a specific investment
  const getThresholdForInvestment = (investment_id: string): number => {
    const assetThreshold = assetThresholds.find(t => t.investment_id === investment_id);
    if (assetThreshold) {
      return assetThreshold.threshold;
    }
    return alertSettings?.global_threshold ?? 5;
  };

  // Check price changes and return alerts
  const checkPriceAlerts = (
    previousPrices: Map<string, number>,
    currentInvestments: Array<{ id: string; asset_name: string; asset_type: string; current_price: number }>
  ): PriceChange[] => {
    const alerts: PriceChange[] = [];

    currentInvestments.forEach(investment => {
      const oldPrice = previousPrices.get(investment.id);
      if (oldPrice === undefined || oldPrice === 0) return;

      const changePercentage = ((investment.current_price - oldPrice) / oldPrice) * 100;
      const threshold = getThresholdForInvestment(investment.id);

      if (Math.abs(changePercentage) >= threshold) {
        alerts.push({
          investment_id: investment.id,
          asset_name: investment.asset_name,
          asset_type: investment.asset_type,
          old_price: oldPrice,
          new_price: investment.current_price,
          change_percentage: Math.round(changePercentage * 100) / 100,
          threshold,
        });
      }
    });

    return alerts;
  };

  return {
    alertSettings,
    assetThresholds,
    isLoading: isLoadingSettings || isLoadingThresholds,
    globalThreshold: alertSettings?.global_threshold ?? 5,
    upsertSettings: upsertSettings.mutate,
    upsertAssetThreshold: upsertAssetThreshold.mutate,
    deleteAssetThreshold: deleteAssetThreshold.mutate,
    getThresholdForInvestment,
    checkPriceAlerts,
  };
};
