import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chunk, fetchAllRows } from "@/lib/fetchAll";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { splitPluggyDuplicates, toSyncedRows, type ImportSource, type NormalizedTransaction } from "@/lib/importers";
import { friendlyErrorMessage } from "@/lib/errors";
import { MAX_CATEGORIZE_ITEMS } from "@shared/validation";

const CHUNK = 500;

export interface FileImportInput {
  accountName: string;
  source: ImportSource;
  transactions: NormalizedTransaction[];
}

export interface FileImportResult {
  total: number;
  inserted: number;
  /** Já importadas antes a partir de um arquivo */
  duplicates: number;
  /** Já vieram pela Pluggy */
  fromPluggy: number;
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
      const allRows = (await toSyncedRows(transactions, { source, accountKey: name, userRules: rules ?? [] })).map((r) => ({
        ...r,
        user_id: user.id,
        bank_connection_id: connectionId!,
      }));

      // Não duplica o que já veio pela Pluggy (mesma data, valor, tipo, tipo de conta e descrição parecida)
      const dates = allRows.map((r) => r.date).sort();
      let rows = allRows;
      if (dates.length) {
        const [pluggyTx, { data: accounts, error: accountsError }] = await Promise.all([
          // Em páginas: um ano de Pluggy passa fácil de 1.000 linhas
          fetchAllRows((from, to) =>
            supabase
              .from("synced_transactions")
              .select("date, amount, type, description, bank_account_id")
              .eq("source", "pluggy")
              .gte("date", dates[0])
              .lte("date", dates[dates.length - 1])
              .order("id")
              .range(from, to),
          ),
          supabase.from("bank_accounts").select("id, type"),
        ]);
        if (accountsError) throw accountsError;
        const accountType = new Map((accounts ?? []).map((a) => [a.id, a.type]));
        rows = splitPluggyDuplicates(
          allRows,
          pluggyTx.map((t) => ({ ...t, accountType: t.bank_account_id ? accountType.get(t.bank_account_id) ?? null : null })),
          source,
        ).rows;
      }
      const skippedPluggy = allRows.length - rows.length;

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
      // A função aceita no máximo MAX_CATEGORIZE_ITEMS por chamada; arquivos grandes vão em partes
      if (toCategorize.length) {
        Promise.allSettled(
          chunk(toCategorize, MAX_CATEGORIZE_ITEMS).map((part) =>
            supabase.functions.invoke("categorize-transactions", { body: { transactions: part } }),
          ),
        ).then(() => queryClient.invalidateQueries({ queryKey: ["synced-transactions"] }));
      }

      return { total: allRows.length, inserted, duplicates: rows.length - inserted, fromPluggy: skippedPluggy };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      toast({
        title: "Arquivo importado",
        description:
          `${result.inserted} novas transações` +
          (result.duplicates ? ` · ${result.duplicates} já tinham sido importadas` : "") +
          (result.fromPluggy ? ` · ${result.fromPluggy} já vieram pela conexão com o banco` : "") +
          ".",
      });
    },
    onError: (error) => {
      toast({ title: "Erro na importação", description: friendlyErrorMessage(error), variant: "destructive" });
    },
  });
};
