import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { friendlyErrorMessage, isMissingSchemaError } from "@/lib/errors";

export type UiMode = "simple" | "complete";

interface Preferences {
  uiMode: UiMode;
  onboardingCompleted: boolean;
  /** true quando o banco ainda não tem as colunas de preferência e usamos o navegador */
  local: boolean;
}

const QUERY_KEY = ["preferences"];
const LOCAL_KEY = "nexos:preferences";

function readLocal(): Omit<Preferences, "local"> | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(p: Omit<Preferences, "local">) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  } catch {
    /* sem armazenamento disponível: a preferência vale só nesta sessão */
  }
}

/**
 * Preferências de interface guardadas no perfil (valem em qualquer dispositivo).
 * Se o banco ainda não tiver as colunas (migração pendente), guarda no navegador em vez de falhar.
 */
export const usePreferences = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const key = [...QUERY_KEY, userId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async (): Promise<Preferences> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("ui_mode, onboarding_completed")
        .eq("id", userId!)
        .maybeSingle();
      if (error) {
        if (isMissingSchemaError(error)) {
          // Conta existente sem migração: não mostra o primeiro acesso e lembra a escolha localmente
          const local = readLocal();
          return { uiMode: local?.uiMode ?? "simple", onboardingCompleted: local?.onboardingCompleted ?? true, local: true };
        }
        throw error;
      }
      return {
        uiMode: data?.ui_mode === "complete" ? "complete" : "simple",
        onboardingCompleted: data?.onboarding_completed ?? false,
        local: false,
      };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: { ui_mode?: UiMode; onboarding_completed?: boolean }) => {
      if (!userId) throw new Error("Not authenticated");
      const current = queryClient.getQueryData<Preferences>(key);
      if (current?.local) return; // já salvo no navegador em onMutate
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch }, { onConflict: "id" });
      if (error) {
        if (isMissingSchemaError(error)) {
          // Migração ainda não aplicada: passa a usar o navegador sem mostrar erro
          queryClient.setQueryData<Preferences>(key, (p) => (p ? { ...p, local: true } : p));
          return;
        }
        throw error;
      }
    },
    onMutate: async (patch) => {
      // Atualiza a tela na hora; desfaz se o servidor recusar
      const previous = queryClient.getQueryData<Preferences>(key);
      if (previous) {
        const next: Preferences = {
          uiMode: patch.ui_mode ?? previous.uiMode,
          onboardingCompleted: patch.onboarding_completed ?? previous.onboardingCompleted,
          local: previous.local,
        };
        queryClient.setQueryData<Preferences>(key, next);
        writeLocal({ uiMode: next.uiMode, onboardingCompleted: next.onboardingCompleted });
      }
      return { previous };
    },
    onError: (error, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast({ title: "Não foi possível salvar a preferência", description: friendlyErrorMessage(error), variant: "destructive" });
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
