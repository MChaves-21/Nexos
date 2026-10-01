// LGPD: exclui a conta e TODOS os dados da pessoa. Pede a palavra EXCLUIR como confirmação.
// Também apaga na Pluggy os itens (conexões bancárias) dessa pessoa, encerrando o acesso aos dados do banco.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorMessage, errorResponse, getServiceClient, getUserClient, jsonResponse } from "../_shared/http.ts";
import { pluggyRequest } from "../_shared/pluggy.ts";
import { getApiKeyForUser } from "../_shared/pluggy-credentials.ts";
import { CONFIRMATION_WORD, isDeletionConfirmed, USER_TABLES_DELETE_ORDER } from "../_shared/user-data.ts";
import { isMissingRelation, PublicError } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const { userId } = auth;

    const body = await req.json().catch(() => ({}));
    if (!isDeletionConfirmed(body)) {
      throw new PublicError(`Digite ${CONFIRMATION_WORD} para confirmar a exclusão da conta.`, 400);
    }

    const service = getServiceClient();

    // 1) Encerra as conexões na Pluggy (melhor esforço: a exclusão continua mesmo se falhar)
    const { data: connections } = await service
      .from("bank_connections")
      .select("pluggy_item_id")
      .eq("user_id", userId)
      .eq("provider", "pluggy");
    if (connections?.length) {
      try {
        const { apiKey } = await getApiKeyForUser(service, userId);
        for (const c of connections) {
          if (!c.pluggy_item_id) continue;
          await pluggyRequest(apiKey, `/items/${encodeURIComponent(c.pluggy_item_id)}`, { method: "DELETE" }).catch((e) =>
            console.warn("delete-account: item não removido na Pluggy:", errorMessage(e)),
          );
        }
      } catch (e) {
        console.warn("delete-account: sem acesso à Pluggy:", errorMessage(e));
      }
    }

    // 2) Família: sai dela (se for administrador, a família deixa de existir)
    const { data: membership } = await service.from("family_members").select("family_id, role").eq("user_id", userId).maybeSingle();
    if (membership?.role === "admin") await service.from("families").delete().eq("id", membership.family_id);
    else if (membership) await service.from("family_members").delete().eq("user_id", userId);

    // 3) Dados de cada tabela
    for (const table of USER_TABLES_DELETE_ORDER) {
      const { error } = await service.from(table).delete().eq("user_id", userId);
      if (error && !isMissingRelation(error)) throw error;
    }
    await service.from("profiles").delete().eq("id", userId);

    // 4) Login
    const { error: authError } = await service.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return jsonResponse({ deleted: true });
  } catch (e) {
    return errorResponse("delete-account error", e);
  }
});
