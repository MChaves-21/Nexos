// Tradução de erros técnicos (rede, Supabase, PostgREST) para mensagens que qualquer pessoa entende.

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

function asErrorLike(e: unknown): ErrorLike {
  if (e && typeof e === "object") return e as ErrorLike;
  return { message: typeof e === "string" ? e : undefined };
}

/** Coluna ou tabela que o app espera ainda não existe no banco (migração não aplicada). */
export function isMissingSchemaError(e: unknown): boolean {
  const { code, message = "" } = asErrorLike(e);
  return code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205" || /schema cache|does not exist/i.test(message);
}

export function isNetworkError(e: unknown): boolean {
  const { message = "", name } = asErrorLike(e);
  if (isChunkLoadError(e)) return false;
  return name === "FunctionsFetchError" || /failed to fetch|networkerror|load failed|network request failed/i.test(message);
}

/** Arquivo da página não carregou (geralmente depois de uma atualização do app). */
export function isChunkLoadError(e: unknown): boolean {
  const { message = "" } = asErrorLike(e);
  return /dynamically imported module|loading chunk|importing a module script failed/i.test(message);
}

export function friendlyErrorMessage(e: unknown): string {
  const err = asErrorLike(e);
  const message = err.message ?? "";
  // Antes da checagem de rede: "Failed to fetch dynamically imported module" também contém "Failed to fetch"
  if (isChunkLoadError(e)) return "O app foi atualizado. Recarregue a página para continuar.";
  if (isNetworkError(e)) return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  if (err.status === 401 || /jwt expired|invalid jwt|not authenticated|unauthorized/i.test(message)) {
    return "Sua sessão expirou. Entre de novo para continuar.";
  }
  if (err.code === "42501" || /permission denied|row-level security/i.test(message)) {
    return "Você não tem permissão para fazer isso.";
  }
  if (isMissingSchemaError(e)) return "O banco de dados do app ainda não foi atualizado. Tente novamente mais tarde.";
  if (err.code === "23505" || /duplicate key/i.test(message)) return "Esse registro já existe.";
  if (err.status === 429 || /rate limit|too many requests/i.test(message)) return "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.";
  // Mensagens já em português vindas das nossas Edge Functions podem ser mostradas
  if (message && /[áéíóúãõç]|^[A-ZÁÉ][a-zà-ú]+ [a-zà-ú]/.test(message) && message.length < 200) return message;
  return "Algo deu errado. Tente novamente em instantes.";
}

/** Não adianta repetir erros do cliente (4xx) ou de esquema; só falhas temporárias. */
export function shouldRetry(failureCount: number, e: unknown): boolean {
  const { status } = asErrorLike(e);
  if (status && status >= 400 && status < 500) return false;
  if (isMissingSchemaError(e)) return false;
  return failureCount < 2;
}
