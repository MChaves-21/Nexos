// Job agendado (pg_cron, ver migração 20260930193700_*.sql) que sincroniza todas as
// conexões Pluggy com auto_sync ligado. Protegido pelo header x-cron-secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorMessage, errorResponse, getServiceClient, jsonResponse } from "../_shared/http.ts";
import { getApiKeyForUser } from "../_shared/pluggy-credentials.ts";
import { syncConnection } from "../_shared/sync-core.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("PLUGGY_CRON_SECRET");
  const received = req.headers.get("x-cron-secret") ?? "";
  if (!expected || !timingSafeEqual(received, expected)) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const supabase = getServiceClient();
    const { data: connections, error } = await supabase
      .from("bank_connections")
      .select("id, user_id, pluggy_item_id, last_sync_at")
      .eq("provider", "pluggy")
      .eq("auto_sync", true)
      // Sem consentimento válido não adianta tentar; o usuário precisa reconectar
      .neq("status", "reauth_required");
    if (error) throw error;

    // Cada pessoa pode ter a própria conta Pluggy: uma API key por usuário
    const apiKeys = new Map<string, Promise<string>>();
    const apiKeyFor = (userId: string) => {
      if (!apiKeys.has(userId)) apiKeys.set(userId, getApiKeyForUser(supabase, userId).then((r) => r.apiKey));
      return apiKeys.get(userId)!;
    };
    const results: Array<{ id: string; ok: boolean; synced?: number; status?: string }> = [];

    for (const connection of connections ?? []) {
      try {
        const r = await syncConnection(supabase, connection, await apiKeyFor(connection.user_id));
        results.push({ id: connection.id, ok: true, synced: r.synced, status: r.status });
      } catch (e) {
        console.error(`sync failed for connection ${connection.id}:`, errorMessage(e));
        await supabase
          .from("bank_connections")
          .update({ status: "error", status_detail: "A sincronização automática falhou." })
          .eq("id", connection.id)
          .eq("user_id", connection.user_id);
        results.push({ id: connection.id, ok: false });
      }
    }

    return jsonResponse({ connections: results.length, results });
  } catch (e) {
    return errorResponse("pluggy-sync-all error", e);
  }
});
