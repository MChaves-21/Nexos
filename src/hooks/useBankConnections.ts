import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface BankConnection {
  id: string;
  user_id: string;
  institution_name: string;
  pluggy_item_id: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncedTransaction {
  id: string;
  user_id: string;
  bank_connection_id: string;
  external_id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  original_category: string | null;
  ai_category: string | null;
  ai_confidence: number | null;
  is_reviewed: boolean;
  synced_at: string;
  created_at: string;
  updated_at: string;
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

  const createConnectToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("pluggy-connect", {
        body: {},
        headers: {},
      });
      // The function uses query params, so we need to use fetch directly
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-connect?action=create-connect-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!resp.ok) throw new Error("Failed to create connect token");
      return resp.json();
    },
  });

  const saveConnection = useMutation({
    mutationFn: async ({ itemId, institutionName }: { itemId: string; institutionName: string }) => {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-connect?action=save-connection`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ itemId, institutionName }),
        }
      );
      if (!resp.ok) throw new Error("Failed to save connection");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast({ title: "Banco conectado", description: "Conexão bancária salva com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-connect?action=delete-connection`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ connectionId }),
        }
      );
      if (!resp.ok) throw new Error("Failed to delete connection");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      toast({ title: "Conexão removida", description: "Banco desconectado com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const syncTransactions = useMutation({
    mutationFn: async (connectionId: string) => {
      const session = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ connectionId }),
        }
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to sync");
      }
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      toast({
        title: "Sincronização concluída",
        description: `${data.synced} novas transações sincronizadas de ${data.total} encontradas.`,
      });
    },
    onError: (error) => {
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    },
  });

  return {
    connections,
    isLoading,
    createConnectToken,
    saveConnection,
    deleteConnection,
    syncTransactions,
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

  const approveCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("synced_transactions")
        .update({ ai_category: category, is_reviewed: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
    },
  });

  const importToTransactions = useMutation({
    mutationFn: async (syncedTxIds: string[]) => {
      const toImport = transactions.filter((t) => syncedTxIds.includes(t.id));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const tx of toImport) {
        await supabase.from("transactions").insert({
          user_id: user.id,
          type: tx.type,
          description: tx.description,
          category: tx.ai_category || tx.original_category || "Outros",
          amount: tx.amount,
          date: tx.date,
        });

        await supabase
          .from("synced_transactions")
          .update({ is_reviewed: true })
          .eq("id", tx.id);
      }
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
