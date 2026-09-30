import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toSyncedRows, type ImportSource, type NormalizedTransaction } from "@/lib/importers";

const CHUNK = 500;

export interface FileImportInput {
  accountName: string;
  source: ImportSource;
  transactions: NormalizedTransaction[];
}

export interface FileImportResult {
  total: number;
  inserted: number;
  duplicates: number;
}

/**
 * Grava as transações de um arquivo em synced_transactions, numa "conexão" do tipo file
 * com o nome da conta. Reimportar o mesmo arquivo não duplica (unique bank_connection_id + external_id).
 */
export const useFileImport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountName, source, transactions }: FileImportInput): Promise<FileImportResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const name = accountName.trim();
      if (!name) throw new Error("Informe o nome da conta");

      // Conta de arquivo: reaproveita se já existir com o mesmo nome
      const { data: existing, error: findError } = await supabase
        .from("bank_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "file")
        .eq("institution_name", name)
        .maybeSingle();
      if (findError) throw findError;

      let connectionId = existing?.id;
      if (!connectionId) {
        const { data: created, error } = await supabase
          .from("bank_connections")
          .insert({ user_id: user.id, provider: "file", institution_name: name, status: "connected", auto_sync: false })
          .select("id")
          .single();
        if (error) throw error;
        connectionId = created.id;
      }

      const { data: rules } = await supabase.from("categorization_rules").select("keyword, category");
      const rows = (await toSyncedRows(transactions, { source, accountKey: name, userRules: rules ?? [] })).map((r) => ({
        ...r,
        user_id: user.id,
        bank_connection_id: connectionId!,
      }));

      let inserted = 0;
      const toCategorize: Array<{ id: string; description: string }> = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { data, error } = await supabase
          .from("synced_transactions")
          .upsert(rows.slice(i, i + CHUNK), { onConflict: "bank_connection_id,external_id", ignoreDuplicates: true })
          .select("id, description, category_source");
        if (error) throw error;
        inserted += data?.length ?? 0;
        for (const row of data ?? []) {
          if (!row.category_source) toCategorize.push({ id: row.id, description: row.description });
        }
      }

      await supabase.from("bank_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", connectionId);

      // IA só para o que as regras não resolveram; falha aqui não invalida a importação
      if (toCategorize.length) {
        supabase.functions
          .invoke("categorize-transactions", { body: { transactions: toCategorize } })
          .then(() => queryClient.invalidateQueries({ queryKey: ["synced-transactions"] }))
          .catch(() => undefined);
      }

      return { total: rows.length, inserted, duplicates: rows.length - inserted };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      toast({
        title: "Arquivo importado",
        description: `${result.inserted} novas transações${result.duplicates ? ` · ${result.duplicates} já existiam e foram ignoradas` : ""}.`,
      });
    },
    onError: (error) => {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    },
  });
};
