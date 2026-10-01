import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AppNotification = Tables<"notifications">;

/** Avisos da pessoa (criados uma vez por dia pelo servidor). */
export const useNotifications = () => {
  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 5 * 60_000,
    // Sem a tabela ainda (migração pendente): sem avisos, sem erro na tela
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) return [] as AppNotification[];
      return (data ?? []) as AppNotification[];
    },
  });

  const unread = notifications.filter((n) => !n.read_at).length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { notifications, unread, markRead, remove };
};
