import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { chunk, fetchAllRows } from "@/lib/fetchAll";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { extractKeyword, resolveCategory } from "@shared/categorization";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyErrorMessage } from "@/lib/errors";

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
  bankUpdatedAt?: string | null;
  /** O banco foi consultado agora? (a Pluggy pode recusar por limite de atualizações) */
  refresh?: "updated" | "still-updating" | "not-allowed" | "failed" | "skipped";
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
    queryClient.invalidateQueries({ queryKey: ["investment-balance-history"] });
  };

  /** Sem itemId: nova conexão. Com itemId: widget em modo de atualização (reconectar). */
  const createConnectToken = useMutation({
    mutationFn: (itemId?: string) =>
      invokeFunction<{ accessToken: string; meuPluggyConnectorId?: number | null }>("pluggy-connect", { action: "create-connect-token", itemId }),
    onError: (error) => {
      toast({ title: "Erro ao abrir a Pluggy", description: friendlyErrorMessage(error), variant: "destructive" });
    },
  });

  const syncTransactions = useMutation({
    mutationFn: (connectionId: string) => invokeFunction<SyncResult>("pluggy-sync", { connectionId }),
    onSuccess: (data) => {
      invalidateAll();
      // A categorização por IA termina depois da resposta (em segundo plano): busca de novo em seguida
      for (const ms of [15_000, 45_000]) {
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["synced-transactions"] }), ms);
      }
      const investments = data.investments ? ` · ${data.investments} investimentos atualizados` : "";
      const freshness =
        data.refresh === "updated" ? " Dados buscados no banco agora."
        : data.refresh === "still-updating" ? " O banco ainda está enviando dados; sincronize de novo em alguns minutos."
        : data.refresh === "not-allowed" ? " O banco não permitiu nova consulta agora; mostrando a última atualização disponível."
        : "";
      toast({
        title: data.status === "reauth_required" ? "Reconexão necessária" : "Sincronização concluída",
        description: data.detail ?? `${data.synced} novas transações de ${data.total} encontradas${investments}.${freshness}`,
        variant: data.status === "reauth_required" ? "destructive" : "default",
      });
    },
    onError: (error) => {
      invalidateAll();
      toast({ title: "Erro na sincronização", description: friendlyErrorMessage(error), variant: "destructive" });
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
      toast({ title: "Erro", description: friendlyErrorMessage(error), variant: "destructive" });
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
      toast({ title: "Erro", description: friendlyErrorMessage(error), variant: "destructive" });
    },
  });

  const setAutoSync = useMutation({
    mutationFn: async ({ id, autoSync }: { id: string; autoSync: boolean }) => {
      const { error } = await supabase.from("bank_connections").update({ auto_sync: autoSync }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bank-connections"] }),
    onError: (error) => {
      toast({ title: "Erro", description: friendlyErrorMessage(error), variant: "destructive" });
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

export interface PluggyAccountStatus {
  configured: boolean;
  /** Client ID mascarado (só os 4 últimos caracteres) */
  clientId?: string;
  verifiedAt?: string;
}

/**
 * Conta Pluggy própria (opcional). Útil para família: cada pessoa usa a própria conta gratuita da Pluggy,
 * já que o plano gratuito aceita só um CPF por conta. Sem ela, vale a conta Pluggy do app.
 */
export const usePluggyAccount = () => {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useQuery({
    queryKey: ["pluggy-account"],
    // Se a função ainda for a versão antiga (sem essa ação), trata como "não configurado" sem alarmar
    queryFn: () =>
      invokeFunction<PluggyAccountStatus>("pluggy-connect", { action: "credentials-status" }).catch((): PluggyAccountStatus => ({ configured: false })),
  });

  const onSaved = (data: PluggyAccountStatus, title: string, description: string) => {
    queryClient.setQueryData(["pluggy-account"], data);
    toast({ title, description });
  };

  const save = useMutation({
    mutationFn: (creds: { clientId: string; clientSecret: string }) =>
      invokeFunction<PluggyAccountStatus>("pluggy-connect", { action: "save-credentials", ...creds }),
    onSuccess: (data) => onSaved(data, "Conta Pluggy salva", "As próximas conexões e sincronizações usam a sua conta Pluggy."),
    onError: (error) => toast({ title: "Não foi possível salvar", description: friendlyErrorMessage(error), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => invokeFunction<PluggyAccountStatus>("pluggy-connect", { action: "delete-credentials" }),
    onSuccess: (data) => onSaved(data, "Conta Pluggy removida", "Voltando a usar a conta Pluggy do app."),
    onError: (error) => toast({ title: "Não foi possível remover", description: friendlyErrorMessage(error), variant: "destructive" }),
  });

  return { status, isLoading, save, remove };
};

/** A função SQL ainda não existe no banco (migração pendente). */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

/** Ids por requisição em filtros .in() (cada id ocupa ~40 caracteres na URL). */
const ID_CHUNK = 100;

export const useSyncedTransactions = (connectionId?: string) => {
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["synced-transactions", connectionId],
    queryFn: async () => {
      // Em páginas: o Supabase corta em 1.000 linhas
      const rows = await fetchAllRows((from, to) => {
        let query = supabase.from("synced_transactions").select("*");
        if (connectionId) query = query.eq("bank_connection_id", connectionId);
        return query.order("date", { ascending: false }).order("id").range(from, to);
      });
      return rows as SyncedTransaction[];
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
      // Os ids vão na URL: em pedaços, para não passar do limite de tamanho
      for (const ids of chunk(similarIds, ID_CHUNK)) {
        await supabase
          .from("synced_transactions")
          .update({ ai_category: category, ai_confidence: 1, category_source: "rule" })
          .in("id", ids);
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
      toast({ title: "Erro", description: friendlyErrorMessage(error), variant: "destructive" });
    },
  });

  const importToTransactions = useMutation({
    mutationFn: async (syncedTxIds: string[]) => {
      const selected = new Set(syncedTxIds);
      const toImport = transactions.filter((t) => selected.has(t.id) && !t.is_reviewed);
      if (!toImport.length) return;
      const items = toImport.map((t) => ({ id: t.id, category: resolveCategory(t.ai_category, t.original_category) }));

      // Marca como revisada e insere numa só transação do banco (migração 20261004100000)
      const { error: rpcError } = await supabase.rpc("import_synced_transactions", { p_items: items });
      if (!rpcError) return;
      if (!isMissingFunction(rpcError)) throw rpcError;

      // Banco ainda sem a função: marca primeiro (só as que ainda não estavam marcadas) e desfaz se a inserção falhar.
      // Assim uma falha no meio esconde a transação por um instante, mas nunca a conta duas vezes.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const categoryById = new Map(items.map((i) => [i.id, i.category]));
      for (const ids of chunk(toImport.map((t) => t.id), ID_CHUNK)) {
        const { data: claimed, error: claimError } = await supabase
          .from("synced_transactions")
          .update({ is_reviewed: true })
          .in("id", ids)
          .eq("is_reviewed", false)
          .select("id, type, description, installment_info, amount, date");
        if (claimError) throw claimError;
        if (!claimed?.length) continue;
        const { error } = await supabase.from("transactions").insert(
          claimed.filter((tx) => Number(tx.amount) > 0).map((tx) => ({
            user_id: user.id,
            type: tx.type === "income" ? ("income" as const) : ("expense" as const),
            description: tx.installment_info ? `${tx.description} (${tx.installment_info})` : tx.description,
            category: categoryById.get(tx.id) ?? "Outros",
            amount: Number(tx.amount),
            date: tx.date,
          })),
        );
        if (error) {
          await supabase.from("synced_transactions").update({ is_reviewed: false }).in("id", claimed.map((c) => c.id));
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transações importadas", description: "As transações foram adicionadas ao seu histórico." });
    },
    onError: (error) => {
      toast({ title: "Erro", description: friendlyErrorMessage(error), variant: "destructive" });
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

export interface BalanceHistoryPoint { bank_connection_id: string; date: string; balance: number }

/** Histórico diário do saldo dos investimentos (vazio se a migração ainda não foi aplicada). */
export const useInvestmentBalanceHistory = () => {
  const { data = [] } = useQuery({
    queryKey: ["investment-balance-history"],
    queryFn: async () => {
      try {
        const rows = await fetchAllRows((from, to) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("investment_balance_history").select("bank_connection_id, date, balance").order("date").order("id").range(from, to),
        );
        return (rows as BalanceHistoryPoint[]).map((r) => ({ ...r, balance: Number(r.balance) }));
      } catch {
        return [];
      }
    },
  });
  return data;
};
