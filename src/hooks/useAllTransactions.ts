import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useSyncedTransactions } from "@/hooks/useBankConnections";
import { mergeTransactions } from "@/lib/mergeTransactions";

export type { UnifiedTransaction } from "@/lib/mergeTransactions";

export const useAllTransactions = () => {
  const manual = useTransactions();
  const synced = useSyncedTransactions();

  const transactions = useMemo(
    () => mergeTransactions(manual.transactions, synced.transactions),
    [manual.transactions, synced.transactions],
  );

  return {
    transactions,
    isLoading: manual.isLoading || synced.isLoading,
    addTransaction: manual.addTransaction,
    updateTransaction: manual.updateTransaction,
    deleteTransaction: manual.deleteTransaction,
    approveCategory: synced.approveCategory,
  };
};
