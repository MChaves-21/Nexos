import { useRef, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface UseUndoableDeleteOptions<T> {
  tableName: string;
  queryKey: string[];
  itemLabel: string;
  getItemDescription?: (item: T) => string;
}

export function useUndoableDelete<T extends { id: string }>({
  tableName,
  queryKey,
  itemLabel,
  getItemDescription,
}: UseUndoableDeleteOptions<T>) {
  const queryClient = useQueryClient();
  const pendingDeleteRef = useRef<{ item: T; timeoutId: NodeJS.Timeout } | null>(null);

  const deleteWithUndo = useCallback(
    async (item: T) => {
      // Cancel any pending delete
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timeoutId);
        pendingDeleteRef.current = null;
      }

      // Optimistically remove from cache
      queryClient.setQueryData<T[]>(queryKey, (old) =>
        old?.filter((i) => i.id !== item.id) ?? []
      );

      const description = getItemDescription?.(item) ?? "";

      // Set up delayed actual deletion
      const timeoutId = setTimeout(async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            .from(tableName)
            .delete()
            .eq("id", item.id);

          if (error) throw error;
          
          pendingDeleteRef.current = null;
        } catch (error) {
          // Restore item on error
          queryClient.invalidateQueries({ queryKey });
          toast.error(`Erro ao excluir ${itemLabel}`, {
            description: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }, 5000);

      pendingDeleteRef.current = { item, timeoutId };

      // Show toast with undo action
      toast.success(`${itemLabel} excluído`, {
        description: description ? `"${description}" foi removido` : undefined,
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            if (pendingDeleteRef.current) {
              clearTimeout(pendingDeleteRef.current.timeoutId);
              // Restore item to cache
              queryClient.setQueryData<T[]>(queryKey, (old) => [
                pendingDeleteRef.current!.item,
                ...(old ?? []),
              ]);
              pendingDeleteRef.current = null;
              toast.info("Exclusão desfeita", {
                description: `${itemLabel} foi restaurado`,
              });
            }
          },
        },
      });
    },
    [queryClient, queryKey, tableName, itemLabel, getItemDescription]
  );

  return { deleteWithUndo };
}
