import { useEffect, useState } from "react";

export const SHOW_MORE_PAGE = 10;

/**
 * Mostra só os primeiros itens de uma lista e libera mais a cada "Ver mais".
 * Volta ao início quando `resetKey` muda (ex.: filtros ou mês trocados).
 */
export function useShowMore<T>(items: T[], pageSize = SHOW_MORE_PAGE, resetKey?: unknown) {
  const [count, setCount] = useState(pageSize);
  useEffect(() => setCount(pageSize), [resetKey, pageSize]);
  return {
    visible: items.slice(0, count),
    remaining: Math.max(0, items.length - count),
    showMore: () => setCount((c) => c + pageSize),
  };
}
