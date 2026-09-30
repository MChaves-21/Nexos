import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorMessage, getUserClient, jsonResponse } from "../_shared/http.ts";
import { getPluggyApiKey, PluggyError, pluggyRequest } from "../_shared/pluggy.ts";
import { mapItemStatus, type PluggyItem } from "../_shared/pluggy-mappers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const { supabase, userId } = auth;

    const body = await req.json().catch(() => ({}));
    // A ação pode vir no corpo (supabase.functions.invoke) ou na query string (versão antiga do front)
    const action = body.action ?? new URL(req.url).searchParams.get("action");

    if (action === "create-connect-token") {
      // Com itemId, o widget abre em modo de atualização (reautorizar consentimento expirado)
      const { itemId } = body;
      if (itemId) {
        const { data: owned } = await supabase
          .from("bank_connections")
          .select("id")
          .eq("user_id", userId)
          .eq("pluggy_item_id", itemId)
          .maybeSingle();
        if (!owned) return jsonResponse({ error: "Connection not found" }, 404);
      }

      const apiKey = await getPluggyApiKey();
      const data = await pluggyRequest<{ accessToken: string }>(apiKey, "/connect_token", {
        method: "POST",
        body: JSON.stringify({
          ...(itemId ? { itemId } : {}),
          options: { clientUserId: userId, avoidDuplicates: true },
        }),
      });
      return jsonResponse({ accessToken: data.accessToken });
    }

    if (action === "save-connection") {
      const { itemId } = body;
      if (!itemId || typeof itemId !== "string") return jsonResponse({ error: "itemId required" }, 400);

      // Valida o item na Pluggy (importante para IDs colados à mão, ex.: Meu Pluggy)
      const apiKey = await getPluggyApiKey();
      let item: PluggyItem;
      try {
        item = await pluggyRequest<PluggyItem>(apiKey, `/items/${encodeURIComponent(itemId.trim())}`);
      } catch (e) {
        if (e instanceof PluggyError && (e.status === 404 || e.status === 400)) {
          // 200 com erro de validação: o front mostra um aviso sem tratar como falha do servidor
          return jsonResponse({ error: "Item não encontrado na Pluggy. Use o botão Abrir Pluggy Connect ou confira o Item ID." }, 200);
        }
        throw e;
      }

      const institutionName = (body.institutionName as string | undefined)?.trim() || item.connector?.name || "Banco";
      const { status, detail, consentExpiresAt } = mapItemStatus(item);

      const { data: existing } = await supabase
        .from("bank_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("pluggy_item_id", item.id)
        .maybeSingle();

      const fields = {
        institution_name: institutionName,
        status,
        status_detail: detail,
        consent_expires_at: consentExpiresAt,
      };

      const query = existing
        ? supabase.from("bank_connections").update(fields).eq("id", existing.id)
        : supabase.from("bank_connections").insert({ ...fields, user_id: userId, pluggy_item_id: item.id, provider: "pluggy" });

      const { data, error } = await query.select().single();
      if (error) throw error;
      return jsonResponse(data);
    }

    if (action === "delete-connection") {
      const { connectionId } = body;
      if (!connectionId) return jsonResponse({ error: "connectionId required" }, 400);

      // Apaga só no Nexos. O item continua na Pluggy/Meu Pluggy, onde o consentimento
      // pode ser revogado pelo próprio usuário.
      const { error } = await supabase
        .from("bank_connections")
        .delete()
        .eq("id", connectionId)
        .eq("user_id", userId);
      if (error) throw error;

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("pluggy-connect error:", errorMessage(e));
    return jsonResponse({ error: errorMessage(e) }, 500);
  }
});
