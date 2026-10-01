import { PublicError } from "./validation.ts";

export const PLUGGY_API_URL = "https://api.pluggy.ai";

/** Falha na API da Pluggy. A mensagem não tem dados do usuário e pode ir para a tela. */
export class PluggyError extends PublicError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = "PluggyError";
  }
}

export interface PluggyCredentials {
  clientId: string;
  clientSecret: string;
}

/** Credenciais padrão do app (as do dono do Nexos), nos segredos da Edge Function. */
export function appCredentials(): PluggyCredentials {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new PublicError("Conexão com bancos indisponível: credenciais da Pluggy não configuradas.", 503);
  return { clientId, clientSecret };
}

/** Troca Client ID + Secret por uma API key temporária da Pluggy. Sem argumento, usa as credenciais do app. */
export async function getPluggyApiKey(creds: PluggyCredentials = appCredentials()): Promise<string> {
  const resp = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: creds.clientId, clientSecret: creds.clientSecret }),
  });
  if (!resp.ok) throw new PluggyError(`Pluggy auth failed [${resp.status}]`, resp.status);

  const { apiKey } = await resp.json();
  return apiKey;
}

export async function pluggyRequest<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${PLUGGY_API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, ...(init.headers ?? {}) },
  });
  if (!resp.ok) {
    // O corpo pode conter dados do usuário; loga só o status
    throw new PluggyError(`Pluggy ${init.method ?? "GET"} ${path.split("?")[0]} failed [${resp.status}]`, resp.status);
  }
  return resp.json();
}

interface Page<T> {
  results: T[];
  page?: number;
  totalPages?: number;
}

/** Busca todas as páginas de um endpoint paginado da Pluggy. */
export async function pluggyGetAll<T>(apiKey: string, path: string, params: Record<string, string>): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  for (;;) {
    // Limite de segurança: no máximo 50 páginas (25 mil registros) por chamada
    if (page > 50) break;
    const qs = new URLSearchParams({ ...params, pageSize: "500", page: String(page) });
    const data = await pluggyRequest<Page<T>>(apiKey, `${path}?${qs}`);
    all.push(...(data.results ?? []));
    const totalPages = data.totalPages ?? 1;
    if (page >= totalPages || !data.results?.length) break;
    page++;
  }
  return all;
}
