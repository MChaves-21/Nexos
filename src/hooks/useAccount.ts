import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { buildExportFile, EXPORT_TABLES, exportFileName, type ExportTable } from "@/lib/dataExport";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface NotificationPrefs {
  email_notifications: boolean;
  weekly_summary: boolean;
}

/** Conta: e-mail, preferências de aviso, exportação e exclusão (LGPD). */
export const useAccount = () => {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["account-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs", user?.id],
    enabled: !!user,
    // Sem a migração ainda aplicada, usa os valores padrão
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data, error } = await supabase.from("profiles").select("email_notifications, weekly_summary").eq("id", user!.id).maybeSingle();
      if (error || !data) return { email_notifications: false, weekly_summary: true };
      return data as NotificationPrefs;
    },
  });

  const savePrefs = useMutation({
    mutationFn: async (patch: Partial<NotificationPrefs>) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-prefs"] }),
    onError: (e) => toast({ title: "Não foi possível salvar", description: friendlyErrorMessage(e), variant: "destructive" }),
  });

  const exportData = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const data: Partial<Record<ExportTable, unknown[]>> = {};
      const unavailable: string[] = [];
      for (const table of EXPORT_TABLES) {
        // RLS garante que só voltam as linhas da própria pessoa
        const { data: rows, error } = await supabase.from(table as never).select("*");
        if (error) unavailable.push(table);
        else data[table] = rows ?? [];
      }
      const file = buildExportFile({ id: user.id, email: user.email ?? null }, data, unavailable);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return Object.values(data).reduce((n, rows) => n + (rows?.length ?? 0), 0);
    },
    onSuccess: (count) => toast({ title: "Dados exportados", description: `${count} registros salvos no arquivo.` }),
    onError: (e) => toast({ title: "Não foi possível exportar", description: friendlyErrorMessage(e), variant: "destructive" }),
  });

  const deleteAccount = useMutation({
    mutationFn: async (confirm: string) => {
      const { error } = await supabase.functions.invoke("delete-account", { body: { confirm } });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const payload = await error.context.json().catch(() => null);
          throw new Error(payload?.error || error.message);
        }
        throw error;
      }
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/auth";
    },
    onError: (e) => toast({ title: "Não foi possível excluir a conta", description: friendlyErrorMessage(e), variant: "destructive" }),
  });

  return { user, prefs, savePrefs, exportData, deleteAccount };
};
