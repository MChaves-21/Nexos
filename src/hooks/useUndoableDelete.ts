import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { friendlyErrorMessage } from "@/lib/errors";
import { DeferredDeletes } from "@/lib/deferredDeletes";

interface UseUndoableDeleteOptions<T> {
  tableName: string;
  queryKey: string[];
  itemLabel: string;
  getItemDescription?: (item: T) => string;
}

const UNDO_MS = 5000;

/** Some da tela na hora e só é apagado no banco depois de 5 s, se a pessoa não desfizer. */
export function useUndoableDelete<T extends { id: string }>({
  tableName,
  queryKey,
  itemLabel,
  getItemDescription,
}: UseUndoableDeleteOptions<T>) {
  const queryClient = useQueryClient();
  const optionsRef = useRef({ tableName, queryKey, itemLabel });
  optionsRef.current = { tableName, queryKey, itemLabel };

  const deletesRef = useRef<DeferredDeletes<T>>();
  deletesRef.current ??= new DeferredDeletes<T>(async (item) => {
    const { tableName, queryKey, itemLabel } = optionsRef.current;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(tableName).delete().eq("id", item.id);
      if (error) throw error;
    } catch (error) {
      // Volta a mostrar o item que não foi apagado
      queryClient.invalidateQueries({ queryKey });
      toast.error(`Erro ao excluir ${itemLabel}`, { description: friendlyErrorMessage(error) });
    }
  }, UNDO_MS);

  // Saindo do app com exclusões esperando: apaga agora em vez de perder
  useEffect(() => {
    const flush = () => void deletesRef.current?.flushAll();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const deleteWithUndo = useCallback(
    async (item: T) => {
      queryClient.setQueryData<T[]>(queryKey, (old) => old?.filter((i) => i.id !== item.id) ?? []);
      deletesRef.current!.schedule(item);

      const description = getItemDescription?.(item) ?? "";
      toast.success(`${itemLabel} excluído`, {
        description: description ? `"${description}" foi removido` : undefined,
        duration: UNDO_MS,
        action: {
          label: "Desfazer",
          onClick: () => {
            // Cada aviso desfaz o próprio item
            const restored = deletesRef.current!.cancel(item.id);
            if (!restored) return;
            queryClient.setQueryData<T[]>(queryKey, (old) => [restored, ...(old ?? []).filter((i) => i.id !== restored.id)]);
            toast.info("Exclusão desfeita", { description: `${itemLabel} foi restaurado` });
          },
        },
      });
    },
    [queryClient, queryKey, itemLabel, getItemDescription],
  );

  return { deleteWithUndo };
}
