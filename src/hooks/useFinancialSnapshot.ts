import { useMemo } from "react";
import { useBankConnections, useSyncedInvestments } from "@/hooks/useBankConnections";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useInvestments } from "@/hooks/useInvestments";
import { averageMonthlySavings } from "@/lib/insights";

/** Números-resumo reutilizados em várias telas: dinheiro guardado e sobra média mensal. */
export const useFinancialSnapshot = () => {
  const { accounts } = useBankConnections();
  const { transactions } = useAllTransactions();
  const { investments } = useSyncedInvestments();
  const { investments: manualInvestments } = useInvestments();

  return useMemo(() => {
    const netWorth =
      accounts.reduce((s, a) => s + (a.type === "CREDIT" ? -Math.abs(Number(a.balance)) : Number(a.balance)), 0) +
      investments.reduce((s, i) => s + Number(i.balance), 0) +
      manualInvestments.reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0);
    return { netWorth, averageSavings: averageMonthlySavings(transactions, new Date()) };
  }, [accounts, investments, manualInvestments, transactions]);
};
