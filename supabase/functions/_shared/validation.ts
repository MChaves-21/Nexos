// Validações e erros "públicos" das Edge Functions. Módulo puro (testado com Vitest).

/** Erro cuja mensagem pode ser mostrada ao usuário (sem detalhes internos). */
export class PublicError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "PublicError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new PublicError(`${field} inválido`, 400);
  return value;
}

/** Item ID da Pluggy: UUID (aceita espaços em volta, comum ao colar). */
export function parseItemId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : value;
  if (!isUuid(id)) throw new PublicError("Item ID inválido. Ele tem o formato 0f1e2d3c-....", 400);
  return id;
}

export const MAX_CATEGORIZE_ITEMS = 500;
export const MAX_DESCRIPTION_LENGTH = 300;

/** Entrada da categorização por IA: lista limitada de {id, description}. Limita custo e abuso. */
export function parseCategorizeInput(body: unknown): Array<{ id: string; description: string }> {
  const list = (body as { transactions?: unknown })?.transactions;
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new PublicError("transactions deve ser uma lista", 400);
  if (list.length > MAX_CATEGORIZE_ITEMS) throw new PublicError(`Máximo de ${MAX_CATEGORIZE_ITEMS} transações por vez`, 400);
  return list.map((t, i) => {
    const id = (t as { id?: unknown })?.id;
    const description = (t as { description?: unknown })?.description;
    if (!isUuid(id) || typeof description !== "string") throw new PublicError(`Transação ${i + 1} inválida`, 400);
    return { id, description: description.slice(0, MAX_DESCRIPTION_LENGTH) };
  });
}

/**
 * O item da Pluggy pertence a este usuário?
 * Itens criados pelo widget carregam clientUserId (o id do usuário no Nexos).
 * Itens do Meu Pluggy não têm; para eles vale a regra "um item, uma conta" (índice único no banco).
 */
export function assertItemOwnership(item: { clientUserId?: string | null }, userId: string): void {
  if (item.clientUserId && item.clientUserId !== userId) {
    throw new PublicError("Esta conexão pertence a outra conta.", 403);
  }
}

/** Mensagem segura para a resposta: detalhes só para PublicError; o resto vai para o log. */
export function publicErrorMessage(e: unknown): string {
  if (e instanceof PublicError) return e.message;
  return "Erro interno. Tente novamente em alguns minutos.";
}

export function errorStatus(e: unknown): number {
  return e instanceof PublicError ? e.status : 500;
}

/** Client ID / Client Secret da Pluggy: texto simples, sem espaços, tamanho razoável. */
export function parsePluggyCredentials(body: unknown): { clientId: string; clientSecret: string } {
  const b = (body ?? {}) as { clientId?: unknown; clientSecret?: unknown };
  const clientId = typeof b.clientId === "string" ? b.clientId.trim() : "";
  const clientSecret = typeof b.clientSecret === "string" ? b.clientSecret.trim() : "";
  const valid = (v: string) => v.length >= 8 && v.length <= 200 && !/\s/.test(v);
  if (!valid(clientId) || !valid(clientSecret)) {
    throw new PublicError("Informe o Client ID e o Client Secret da Pluggy, sem espaços.", 400);
  }
  return { clientId, clientSecret };
}
