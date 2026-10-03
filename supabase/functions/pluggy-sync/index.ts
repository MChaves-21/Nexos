import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, getServiceClient, getUserClient, jsonResponse } from "../_shared/http.ts";
import { requireUuid } from "../_shared/validation.ts";
import { getApiKeyForUser } from "../_shared/pluggy-credentials.ts";
import { syncConnection } from "../_shared/sync-core.ts";
import { refreshItem } from "../_shared/item-refresh.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const { supabase, userId } = auth;

    const body = await req.json().catch(() => ({}));
    const connectionId = requireUuid(body.connectionId, "connectionId");

    const { data: connection, error: connError } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", userId)
      .single();

    if (connError || !connection) return jsonResponse({ error: "Conexão não encontrada" }, 404);
    if (connection.provider !== "pluggy") {
      return jsonResponse({ error: "Contas importadas por arquivo não são sincronizadas; importe um novo arquivo." }, 400);
    }

    await supabase.from("bank_connections").update({ status: "syncing" }).eq("id", connectionId);

    try {
      const { apiKey } = await getApiKeyForUser(getServiceClient(), userId);
      // Sincronizar na mão = dados de agora: pede à Pluggy para buscar no banco antes de ler.
      // Se ela recusar ou demorar, segue com o que já existe (a próxima sync pega o resto).
      let refresh: string = "skipped";
      if (connection.pluggy_item_id) {
        try {
          refresh = await refreshItem(apiKey, connection.pluggy_item_id);
        } catch (e) {
          console.warn("pluggy-sync: atualização no banco falhou:", e instanceof Error ? e.message : "erro");
          refresh = "failed";
        }
      }
      const result = await syncConnection(supabase, connection, apiKey);
      return jsonResponse({ ...result, refresh });
    } catch (e) {
      await supabase
        .from("bank_connections")
        .update({ status: "error", status_detail: "Falha ao sincronizar. Tente novamente em alguns minutos." })
        .eq("id", connectionId);
      throw e;
    }
  } catch (e) {
    return errorResponse("pluggy-sync error", e);
  }
});
