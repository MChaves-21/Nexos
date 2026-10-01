import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MarketRates {
  /** % ao ano */
  selic: number;
  cdi: number;
  /** IPCA acumulado em 12 meses, % */
  ipca: number;
  updatedAt: string | null;
  source: "bcb" | "fallback";
}

// Usado enquanto carrega ou se a função estiver indisponível
export const FALLBACK_RATES: MarketRates = { selic: 15, cdi: 14.9, ipca: 5, updatedAt: null, source: "fallback" };

/** Selic, CDI e inflação atuais (Banco Central), via Edge Function market-rates. */
export const useMarketRates = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["market-rates"],
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<MarketRates> => {
      const { data, error } = await supabase.functions.invoke("market-rates", { body: {} });
      if (error || !data) return FALLBACK_RATES;
      return data as MarketRates;
    },
  });
  return { rates: data ?? FALLBACK_RATES, isLoading };
};
