import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { friendlyErrorMessage } from "@/lib/errors";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type BillRow = Tables<"bills">;
export type BillPaymentRow = Tables<"bill_payments">;

/** Contas a pagar e os pagamentos de um mês (YYYY-MM). */
export const useBills = (period: string) => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["bills"] });
  const onError = (title: string) => (e: unknown) => toast({ title, description: friendlyErrorMessage(e), variant: "destructive" });

  const { data: bills = [], isLoading, isError } = useQuery({
    queryKey: ["bills", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("title");
      if (error) throw error;
      return data as BillRow[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["bills", "payments", period],
    queryFn: async () => {
      const { data, error } = await supabase.from("bill_payments").select("*").eq("period", period);
      if (error) throw error;
      return data as BillPaymentRow[];
    },
  });

  const addBill = useMutation({
    mutationFn: async (bill: Omit<TablesInsert<"bills">, "user_id">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("bills").insert({ ...bill, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Conta cadastrada", description: "Você será avisado 3 dias antes do vencimento." }); },
    onError: onError("Não foi possível cadastrar"),
  });

  const removeBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: onError("Não foi possível apagar"),
  });

  const setPaid = useMutation({
    mutationFn: async ({ bill, paid }: { bill: BillRow; paid: boolean }) => {
      if (paid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from("bill_payments").upsert(
          { user_id: user.id, bill_id: bill.id, period, amount: bill.amount },
          { onConflict: "bill_id,period" },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bill_payments").delete().eq("bill_id", bill.id).eq("period", period);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: onError("Não foi possível atualizar"),
  });

  return { bills, payments, isLoading, unavailable: isError, addBill, removeBill, setPaid };
};
