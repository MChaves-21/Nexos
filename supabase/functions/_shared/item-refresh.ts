// Pede à Pluggy para buscar dados novos no banco antes de sincronizar.
// Sem isso, o "Sincronizar" só lê o que a Pluggy guardou na última atualização dela.
import { PluggyError, pluggyRequest } from "./pluggy.ts";
import type { PluggyItem } from "./pluggy-mappers.ts";

export type RefreshOutcome = "updated" | "still-updating" | "not-allowed";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Dispara a atualização do item e espera ela terminar (no máximo `timeoutMs`).
 * - "updated": a Pluggy terminou de buscar no banco;
 * - "still-updating": demorou mais que o limite; lemos o que já existe e a próxima sync pega o resto;
 * - "not-allowed": a Pluggy recusou (ex.: limite de atualizações do Open Finance, item do Meu Pluggy).
 */
export async function refreshItem(
  apiKey: string,
  itemId: string,
  { timeoutMs = 40_000, pollMs = 3_000 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<RefreshOutcome> {
  const path = `/items/${encodeURIComponent(itemId)}`;
  try {
    await pluggyRequest<PluggyItem>(apiKey, path, { method: "PATCH", body: "{}" });
  } catch (e) {
    if (e instanceof PluggyError && e.status >= 400 && e.status < 500) return "not-allowed";
    throw e;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    const item = await pluggyRequest<PluggyItem>(apiKey, path);
    const running = item.status === "UPDATING" || (item.executionStatus ?? "").endsWith("_IN_PROGRESS") || item.executionStatus === "CREATED";
    if (!running) return "updated";
  }
  return "still-updating";
}
