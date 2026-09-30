import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { extractKeyword } from "@shared/categorization";
import type { Tables } from "@/integrations/supabase/types";

export type BankConnection = Tables<"bank_connections">;
export type BankAccount = Tables<"bank_accounts">;
export type SyncedTransaction = Tables<"synced_transactions">;
export type SyncedInvestment = Tables<"synced_investments">;

export interface SyncResult {
  synced: number;
  total: number;
  accounts: number;
  investments: number;
  status: string;
  detail: string | null;
}

/** Chama uma Edge Function e devolve a mensagem de erro dela em vez do genérico "non-2xx". */
async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error || error.message);
    }
    throw error;
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export const useBankConnections = () => {
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["bank-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_connections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BankConnection[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("name");
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["synced-investments"] });
  };

  /** Sem itemId: nova conexão. Com itemId: widget em modo de atualização (reconectar). */
  const createConnectToken = useMutation({
    mutationFn: (itemId?: string) =>
      invokeFunction<{ accessToken: string }>("pluggy-connect", { action: "create-connect-token", itemId }),
    onError: (error) => {
      toast({ title: "Erro ao abrir a Pluggy", description: error.message, variant: "destructive" });
    },
  });

  const syncTransactions = useMutation({
    mutationFn: (connectionId: string) => invokeFunction<SyncResult>("pluggy-sync", { connectionId }),
    onSuccess: (data) => {
      invalidateAll();
      const investments = data.investments ? ` · ${data.investments} investimentos atualizados` : "";
      toast({
        title: data.status === "reauth_required" ? "Reconexão necessária" : "Sincronização concluída",
        description: data.detail ?? `${data.synced} novas transações de ${data.total} encontradas${investments}.`,
        variant: data.status === "reauth_required" ? "destructive" : "default",
      });
    },
    onError: (error) => {
      invalidateAll();
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    },
  });

  const saveConnection = useMutation({
    mutationFn: ({ itemId, institutionName }: { itemId: string; institutionName?: string }) =>
      invokeFunction<BankConnection>("pluggy-connect", { action: "save-connection", itemId, institutionName }),
    onSuccess: (connection) => {
      invalidateAll();
      toast({ title: "Banco conectado", description: "Buscando contas, transações e investimentos..." });
      // Primeira sincronização logo após conectar
      syncTransactions.mutate(connection.id);
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: (connectionId: string) =>
      invokeFunction<{ success: boolean }>("pluggy-connect", { action: "delete-connection", connectionId }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Conexão removida", description: "Banco desconectado com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const setAutoSync = useMutation({
    mutationFn: async ({ id, autoSync }: { id: string; autoSync: boolean }) => {
      const { error } = await supabase.from("bank_connections").update({ auto_sync: autoSync }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-connections"] }),
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return {
    connections,
    accounts,
    isLoading,
    createConnectToken,
    saveConnection,
    deleteConnection,
    syncTransactions,
    setAutoSync,
  };
};

export const useSyncedTransactions = (connectionId?: string) => {
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["synced-transactions", connectionId],
    queryFn: async () => {
      let query = supabase
        .from("synced_transactions")
        .select("*")
        .order("date", { ascending: false });

      if (connectionId) {
        query = query.eq("bank_connection_id", connectionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncedTransaction[];
    },
  });

  /**
   * Corrige a categoria e aprende a regra: a palavra-chave da descrição passa a valer
   * para as próximas importações e para as transações pendentes parecidas.
   * Escolher categoria não marca como importada (is_reviewed é só da importação).
   */
  const approveCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("synced_transactions")
        .update({ ai_category: category, ai_confidence: 1, category_source: "user" })
        .eq("id", id);
      if (error) throw error;

      const tx = transactions.find((t) => t.id === id);
      const keyword = tx ? extractKeyword(tx.description) : "";
      if (!keyword) return { keyword: null, applied: 0 };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: ruleError } = await supabase
        .from("categorization_rules")
        .upsert({ user_id: user.id, keyword, category }, { onConflict: "user_id,keyword" });
      if (ruleError) throw ruleError;

      // Aplica às pendentes com a mesma palavra-chave que não foram escolhidas à mão
      const similarIds = transactions
        .filter((t) => t.id !== id && !t.is_reviewed && t.category_source !== "user" && extractKeyword(t.description) === keyword)
        .map((t) => t.id);
      if (similarIds.length) {
        await supabase
          .from("synced_transactions")
          .update({ ai_category: category, ai_confidence: 1, category_source: "rule" })
          .in("id", similarIds);
      }
      return { keyword, applied: similarIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      if (result.keyword && result.applied > 0) {
        toast({
          title: "Regra aprendida",
          description: `"${result.keyword}" aplicada a mais ${result.applied} transaç${result.applied > 1 ? "ões" : "ão"}.`,
        });
      }
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const importToTransactions = useMutation({
    mutationFn: async (syncedTxIds: string[]) => {
      const toImport = transactions.filter((t) => syncedTxIds.includes(t.id) && !t.is_reviewed);
      if (!toImport.length) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("transactions").insert(
        toImport.map((tx) => ({
          user_id: user.id,
          type: tx.type,
          description: tx.installment_info ? `${tx.description} (${tx.installment_info})` : tx.description,
          category: tx.ai_category || tx.original_category || "Outros",
          amount: tx.amount,
          date: tx.date,
        })),
      );
      if (error) throw error;

      const { error: updateError } = await supabase
        .from("synced_transactions")
        .update({ is_reviewed: true })
        .in("id", toImport.map((t) => t.id));
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transações importadas", description: "As transações foram adicionadas ao seu histórico." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return {
    transactions,
    isLoading,
    approveCategory,
    importToTransactions,
  };
};

export const useSyncedInvestments = () => {
  const { data: investments = [], isLoading } = useQuery({
    queryKey: ["synced-investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("synced_investments")
        .select("*")
        .order("balance", { ascending: false });
      if (error) throw error;
      return data as SyncedInvestment[];
    },
  });

  return { investments, isLoading };
};
