import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { PluggyError, pluggyGetAll, pluggyRequest } from "./pluggy.ts";
import {
  mapAccount,
  mapInvestment,
  mapItemStatus,
  mapTransaction,
  resolveInstitutionName,
  shouldImportTransaction,
  syncFromDate,
  type PluggyAccount,
  type PluggyInvestment,
  type PluggyItem,
  type PluggyTransaction,
} from "./pluggy-mappers.ts";
import { categorizeByRules, type CategorizationRule } from "./categorization.ts";
import { categorizeWithAI } from "./ai-categorize.ts";
import { assertItemOwnership } from "./validation.ts";

export interface BankConnectionRow {
  id: string;
  user_id: string;
  pluggy_item_id: string | null;
  last_sync_at: string | null;
}

export interface SyncResult {
  synced: number;
  total: number;
  accounts: number;
  investments: number;
  status: string;
  detail: string | null;
}

const CHUNK = 500;

/**
 * Sincroniza uma conexão Pluggy: status do item, contas, transações e investimentos.
 * Funciona tanto com o cliente do usuário (RLS) quanto com service role; em ambos os casos
 * todas as escritas carregam o user_id da conexão.
 */
export async function syncConnection(
  supabase: SupabaseClient,
  connection: BankConnectionRow,
  apiKey: string,
): Promise<SyncResult> {
  const userId = connection.user_id;
  const itemId = connection.pluggy_item_id;
  if (!itemId) throw new Error("Conexão sem item da Pluggy");

  // 1. Status do item (consentimento expirado, erro de login...)
  let item: PluggyItem;
  try {
    item = await pluggyRequest<PluggyItem>(apiKey, `/items/${encodeURIComponent(itemId)}`);
  } catch (e) {
    if (e instanceof PluggyError && e.status === 404) {
      const detail = "Conexão não encontrada na Pluggy. Remova e conecte o banco de novo.";
      await supabase.from("bank_connections").update({ status: "error", status_detail: detail }).eq("id", connection.id);
      return { synced: 0, total: 0, accounts: 0, investments: 0, status: "error", detail };
    }
    throw e;
  }
  // Defesa extra: nunca sincroniza item criado por outro usuário
  assertItemOwnership(item, userId);
  const itemStatus = mapItemStatus(item);

  // 2. Contas
  const { results: pluggyAccounts = [] } = await pluggyRequest<{ results: PluggyAccount[] }>(
    apiKey,
    `/accounts?itemId=${encodeURIComponent(itemId)}`,
  );

  const accountRows = pluggyAccounts.map((a) => ({ ...mapAccount(a), user_id: userId, bank_connection_id: connection.id }));
  const accountIdByExternal = new Map<string, string>();
  if (accountRows.length) {
    const { data, error } = await supabase
      .from("bank_accounts")
      .upsert(accountRows, { onConflict: "bank_connection_id,external_id" })
      .select("id, external_id");
    if (error) throw error;
    for (const row of data ?? []) accountIdByExternal.set(row.external_id, row.id);
  }

  // 3. Transações de cada conta, com paginação e janela de datas
  const from = syncFromDate(connection.last_sync_at);
  const to = new Date().toISOString().slice(0, 10);

  const { data: userRules } = await supabase
    .from("categorization_rules")
    .select("keyword, category")
    .eq("user_id", userId);
  const rules = (userRules ?? []) as CategorizationRule[];

  let total = 0;
  let synced = 0;
  const toCategorize: Array<{ id: string; description: string }> = [];

  for (const account of pluggyAccounts) {
    const txs = await pluggyGetAll<PluggyTransaction>(apiKey, "/transactions", { accountId: account.id, from, to });
    const importable = txs.filter(shouldImportTransaction);
    total += importable.length;

    const rows = importable.map((tx) => {
      const mapped = mapTransaction(tx, account.type);
      const match = categorizeByRules(mapped.description, rules);
      return {
        ...mapped,
        user_id: userId,
        bank_connection_id: connection.id,
        bank_account_id: accountIdByExternal.get(account.id) ?? null,
        ai_category: match?.category ?? null,
        ai_confidence: match ? 1 : null,
        category_source: match ? "rule" : null,
      };
    });

    for (let i = 0; i < rows.length; i += CHUNK) {
      // ignoreDuplicates => ON CONFLICT DO NOTHING; o retorno contém só as linhas novas
      const { data, error } = await supabase
        .from("synced_transactions")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "bank_connection_id,external_id", ignoreDuplicates: true })
        .select("id, description, category_source");
      if (error) throw error;
      synced += data?.length ?? 0;
      for (const row of data ?? []) {
        if (!row.category_source) toCategorize.push({ id: row.id, description: row.description });
      }
    }
  }

  // 4. Investimentos (nem todo banco/plano expõe esse produto; falha aqui não derruba a sync)
  let investments = 0;
  let investmentWarning: string | null = null;
  try {
    const pluggyInvestments = await pluggyGetAll<PluggyInvestment>(apiKey, "/investments", { itemId });
    const invRows = pluggyInvestments.map((inv) => ({
      ...mapInvestment(inv),
      user_id: userId,
      bank_connection_id: connection.id,
      synced_at: new Date().toISOString(),
    }));
    if (invRows.length) {
      const { error } = await supabase
        .from("synced_investments")
        .upsert(invRows, { onConflict: "bank_connection_id,external_id" });
      if (error) throw error;
    }
    // Remove posições que não existem mais no banco (resgatadas/vencidas)
    const current = invRows.map((r) => r.external_id);
    let del = supabase.from("synced_investments").delete().eq("bank_connection_id", connection.id).eq("user_id", userId);
    if (current.length) del = del.not("external_id", "in", `(${current.map((id) => `"${id}"`).join(",")})`);
    await del;
    investments = invRows.length;
  } catch (e) {
    console.error("investments sync failed:", e instanceof Error ? e.message : e);
    investmentWarning = "Não foi possível buscar os investimentos desta conexão.";
  }

  // 5. Estado da conexão
  const detail = [itemStatus.detail, investmentWarning].filter(Boolean).join(" ") || null;
  await supabase
    .from("bank_connections")
    .update({
      institution_name: resolveInstitutionName(item, pluggyAccounts),
      last_sync_at: new Date().toISOString(),
      status: itemStatus.status,
      status_detail: detail,
      consent_expires_at: itemStatus.consentExpiresAt,
    })
    .eq("id", connection.id);

  // 6. IA só para o que as regras não resolveram
  if (toCategorize.length) {
    try {
      await categorizeWithAI(supabase, toCategorize);
    } catch (e) {
      console.error("AI categorization error:", e instanceof Error ? e.message : e);
    }
  }

  return { synced, total, accounts: pluggyAccounts.length, investments, status: itemStatus.status, detail };
}
