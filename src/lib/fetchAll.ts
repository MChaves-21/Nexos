// O Supabase devolve no máximo 1.000 linhas por consulta, sem avisar que cortou.
// Estas funções buscam tudo em páginas e dividem listas grandes de ids.

export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Busca todas as linhas, página por página. `page(from, to)` deve montar a consulta com
 * `.range(from, to)` e uma ordem estável (ex.: `.order("date").order("id")`), senão linhas
 * empatadas podem se repetir ou sumir entre as páginas.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>, pageSize = PAGE_SIZE): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}

/** Divide uma lista em pedaços (ex.: ids para `.in()`, que vão na URL e têm limite de tamanho). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
