import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type UiMode = "simple" | "complete";

interface Preferences {
  uiMode: UiMode;
  onboardingCompleted: boolean;
}

const QUERY_KEY = ["preferences"];

/** Preferências de interface guardadas no perfil (valem em qualquer dispositivo). */
export const usePreferences = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, userId],
    enabled: !!userId,
    queryFn: async (): Promise<Preferences> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("ui_mode, onboarding_completed")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return {
        uiMode: data?.ui_mode === "complete" ? "complete" : "simple",
        onboardingCompleted: data?.onboarding_completed ?? false,
      };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: { ui_mode?: UiMode; onboarding_completed?: boolean }) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch }, { onConflict: "id" });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      // Atualiza a tela na hora; desfaz se o servidor recusar
      const key = [...QUERY_KEY, userId];
      const previous = queryClient.getQueryData<Preferences>(key);
      if (previous) {
        queryClient.setQueryData<Preferences>(key, {
          uiMode: patch.ui_mode ?? previous.uiMode,
          onboardingCompleted: patch.onboarding_completed ?? previous.onboardingCompleted,
        });
      }
      return { previous, key };
    },
    onError: (error, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: "Não foi possível salvar a preferência", description: error.message, variant: "destructive" });
    },
  });

  return {
    uiMode: data?.uiMode ?? "simple",
    isComplete: data?.uiMode === "complete",
    onboardingCompleted: data?.onboardingCompleted ?? true,
    isLoading: isLoading || !userId,
    setUiMode: (mode: UiMode) => update.mutate({ ui_mode: mode }),
    completeOnboarding: () => update.mutate({ onboarding_completed: true }),
  };
};
