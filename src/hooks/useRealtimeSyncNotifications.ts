import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useRealtimeSyncNotifications = () => {
  const queryClient = useQueryClient();
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("synced-transactions-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "synced_transactions",
        },
        () => {
          countRef.current += 1;

          // Debounce: batch notifications over 2 seconds
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            const count = countRef.current;
            countRef.current = 0;

            toast({
              title: "🔔 Novas transações sincronizadas",
              description: `${count} nova${count > 1 ? "s" : ""} transaç${count > 1 ? "ões" : "ão"} importada${count > 1 ? "s" : ""} do banco.`,
            });

            queryClient.invalidateQueries({ queryKey: ["synced-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
