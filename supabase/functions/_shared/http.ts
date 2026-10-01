import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { errorStatus, publicErrorMessage } from "./validation.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Cliente Supabase agindo como o usuário da requisição (RLS aplicado). Retorna null se o token for inválido. */
export async function getUserClient(req: Request): Promise<{ supabase: SupabaseClient; userId: string; authHeader: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string, authHeader };
}

/** Cliente com service role (ignora RLS). Use somente em jobs internos e sempre filtre por user_id. */
export function getServiceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Mensagem completa, só para logs. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  // Erros do PostgREST chegam como objeto { code, message }, não como Error
  const o = e as { code?: string; message?: string } | null;
  if (o && typeof o.message === "string") return o.code ? `[${o.code}] ${o.message}` : o.message;
  return "Unknown error";
}

/** Resposta de erro segura: loga o detalhe e devolve só o que pode ser mostrado. */
export function errorResponse(context: string, e: unknown): Response {
  console.error(`${context}:`, errorMessage(e));
  return jsonResponse({ error: publicErrorMessage(e) }, errorStatus(e));
}
