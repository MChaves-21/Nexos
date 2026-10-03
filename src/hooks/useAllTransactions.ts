import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/useTransactions";
import { useSyncedTransactions } from "@/hooks/useBankConnections";
import { buildLedger } from "@/lib/mergeTransactions";

export type { UnifiedTransaction } from "@/lib/mergeTransactions";

export const useAllTransactions = () => {
  const manual = useTransactions();
  const synced = useSyncedTransactions();
  // Mesma chave do useBankConnections: o React Query reaproveita a busca
  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const ledger = useMemo(() => {
    const cardAccountIds = new Set(accounts.filter((a) => a.type === "CREDIT").map((a) => a.id));
    return buildLedger(manual.transactions, synced.transactions, { cardAccountIds });
  }, [manual.transactions, synced.transactions, accounts]);

  return {
    transactions: ledger.transactions,
    /** Lançamentos manuais que o banco também trouxe: fora dos totais até a pessoa decidir */
    manualDuplicates: ledger.manualDuplicates,
    isLoading: manual.isLoading || synced.isLoading,
    addTransaction: manual.addTransaction,
    updateTransaction: manual.updateTransaction,
    deleteTransaction: manual.deleteTransaction,
    approveCategory: synced.approveCategory,
  };
};
