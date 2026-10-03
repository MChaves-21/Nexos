import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { PluggyError, pluggyGetAll, pluggyRequest } from "./pluggy.ts";
import {
  mapAccount,
  mapInvestment,
  mapItemStatus,
  mapTransaction,
  resolveInstitutionName,
  shouldImportTransaction,
  changedTransactions,
  staleTransactionIds,
  syncAnchor,
  syncFromDate,
  type PluggyAccount,
  type PluggyInvestment,
  type PluggyItem,
  type PluggyTransaction,
} from "./pluggy-mappers.ts";
import { categorizeIncoming, type CategorizationRule } from "./categorization.ts";
import { categorizeWithAI } from "./ai-categorize.ts";
import { assertItemOwnership, isMissingRelation } from "./validation.ts";
import { localDate } from "./dates.ts";

export interface BankConnectionRow {
  id: string;
  user_id: string;
  pluggy_item_id: string | null;
  last_sync_at: string | null;
  /** Quando o banco mandou dados para a Pluggy pela última vez (coluna pode não existir em bancos antigos) */
  bank_updated_at?: string | null;
}

export interface SyncResult {
  synced: number;
  total: number;
  accounts: number;
  investments: number;
  status: string;
  detail: string | null;
  /** Quando a Pluggy buscou os dados no banco pela última vez */
  bankUpdatedAt?: string | null;
}

const CHUNK = 500;

/** Supabase Edge Runtime: termina o trabalho depois de responder. Fora dele, a promessa segue sem ser esperada. */
function runInBackground(job: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(job);
}
/** Máximo de transações sem categoria mandadas para a IA por sincronização (custo) */
const AI_LIMIT = 300;

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
      return { synced: 0, total: 0, accounts: 0, investments: 0, status: "error", detail, bankUpdatedAt: null };
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
    const upsertAccounts = (rows: typeof accountRows | Array<Record<string, unknown>>) =>
      supabase.from("bank_accounts").upsert(rows, { onConflict: "bank_connection_id,external_id" }).select("id, external_id");
    let { data, error } = await upsertAccounts(accountRows);
    if (error && isMissingRelation(error)) {
      // Banco ainda sem as colunas da fatura (migração pendente): grava sem elas
      const legacy = accountRows.map(({ balance_due_date, balance_close_date, minimum_payment, card_brand, ...rest }) => rest);
      ({ data, error } = await upsertAccounts(legacy));
    }
    if (error) throw error;
    for (const row of data ?? []) accountIdByExternal.set(row.external_id, row.id);
  }

  // Só um item UPDATED tem dados completos e atuais: sem isso não apagamos nada nem avançamos a janela
  const fresh = item.status === "UPDATED";

  // 3. Transações de cada conta, com paginação e janela de datas
  const from = syncFromDate(syncAnchor(connection));
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
      const match = categorizeIncoming(mapped.description, mapped.original_category, rules);
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

    const accountId = accountIdByExternal.get(account.id);
    if (!accountId || !rows.length) continue;
    // O que já está gravado nesta conta, na janela consultada (em páginas: o PostgREST corta em 1.000)
    const stored: Array<{
      id: string; external_id: string; date: string; is_reviewed: boolean; description: string;
      amount: number; type: string; installment_info: string | null; original_category: string | null;
    }> = [];
    for (let page = 0; ; page += 1000) {
      const { data, error } = await supabase
        .from("synced_transactions")
        .select("id, external_id, date, is_reviewed, description, amount, type, installment_info, original_category")
        .eq("bank_account_id", accountId)
        .eq("source", "pluggy")
        .gte("date", from)
        .lte("date", to)
        .order("id")
        .range(page, page + 999);
      if (error) throw error;
      stored.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }

    // O banco pode corrigir valor, data ou descrição de uma transação já gravada (ex.: compra em dólar
    // fechada no câmbio do dia). Regrava só as que mudaram; categoria e "importada" ficam como estão.
    const changed = changedTransactions(rows, stored).map(({ ai_category, ai_confidence, category_source, ...rest }) => rest);
    for (let i = 0; i < changed.length; i += CHUNK) {
      const { error } = await supabase
        .from("synced_transactions")
        .upsert(changed.slice(i, i + CHUNK), { onConflict: "bank_connection_id,external_id" });
      if (error) throw error;
    }

    // Compras canceladas/desfeitas somem da Pluggy: remove da janela consultada. Só com dados completos
    // (item atualizado) e se a conta trouxe alguma transação, para uma resposta vazia não apagar tudo.
    if (fresh && txs.length > 0) {
      const fetched = new Set(txs.map((t) => t.id));
      const stale = staleTransactionIds(stored, fetched, from, to);
      for (let i = 0; i < stale.length; i += 100) {
        const { error: delError } = await supabase.from("synced_transactions").delete().in("id", stale.slice(i, i + 100));
        if (delError) throw delError;
      }
    }
  }

  // Transações antigas sem categoria (ex.: Pix que a regra antiga chamava de "Transferência"):
  // aplica as regras de agora e manda o resto para a IA
  {
    const { data: pending } = await supabase
      .from("synced_transactions")
      .select("id, description, original_category")
      .eq("bank_connection_id", connection.id)
      .is("category_source", null)
      .limit(1000);
    const known = new Set(toCategorize.map((t) => t.id));
    const byCategory = new Map<string, string[]>();
    for (const row of pending ?? []) {
      if (known.has(row.id)) continue;
      const match = categorizeIncoming(row.description, row.original_category, rules);
      if (match) byCategory.set(match.category, [...(byCategory.get(match.category) ?? []), row.id]);
      else toCategorize.push({ id: row.id, description: row.description });
    }
    for (const [category, ids] of byCategory) {
      for (let i = 0; i < ids.length; i += 100) {
        await supabase
          .from("synced_transactions")
          .update({ ai_category: category, ai_confidence: 1, category_source: "rule" })
          .in("id", ids.slice(i, i + 100))
          .is("category_source", null);
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
    investments = invRows.length;

    if (fresh) {
      // Remove posições que não existem mais no banco (resgatadas/vencidas)
      const current = invRows.map((r) => r.external_id);
      let del = supabase.from("synced_investments").delete().eq("bank_connection_id", connection.id).eq("user_id", userId);
      if (current.length) del = del.not("external_id", "in", `(${current.map((id) => `"${id}"`).join(",")})`);
      await del;
    }

    // Saldo do dia (horário de Brasília) para estimar o rendimento quando o banco não informa.
    // Grava sempre que vierem posições; lista vazia só conta com dados completos (senão viraria "saldo zero"
    // e um falso prejuízo). Antes só gravava com o item atualizado, e o rendimento ficava em "Calculando".
    if (invRows.length > 0 || fresh) {
      const total = invRows.reduce((s, r) => s + Number(r.balance ?? 0), 0);
      const { error: historyError } = await supabase.from("investment_balance_history").upsert(
        { user_id: userId, bank_connection_id: connection.id, date: localDate(new Date()).iso, balance: total },
        { onConflict: "bank_connection_id,date" },
      );
      if (historyError && !isMissingRelation(historyError)) console.error("balance history failed:", historyError.message);
    }
  } catch (e) {
    console.error("investments sync failed:", e instanceof Error ? e.message : e);
    investmentWarning = "Não foi possível buscar os investimentos desta conexão.";
  }

  // 5. Estado da conexão
  const detail = [itemStatus.detail, investmentWarning].filter(Boolean).join(" ") || null;
  const state = {
    institution_name: resolveInstitutionName(item, pluggyAccounts),
    // Só avança com dados completos: a próxima busca começa daqui (menos 10 dias)
    ...(fresh ? { last_sync_at: new Date().toISOString() } : {}),
    status: itemStatus.status,
    status_detail: detail,
    consent_expires_at: itemStatus.consentExpiresAt,
  };
  const { error: stateError } = await supabase
    .from("bank_connections")
    .update({ ...state, ...(item.lastUpdatedAt ? { bank_updated_at: item.lastUpdatedAt } : {}) })
    .eq("id", connection.id);
  // Banco sem a coluna bank_updated_at ou sem permissão de gravá-la pelo app (migração pendente): grava o resto
  if (stateError) {
    const { error: retryError } = await supabase.from("bank_connections").update(state).eq("id", connection.id);
    if (retryError) console.error("connection state update failed:", retryError.message);
  }

  // 6. IA só para o que as regras não resolveram. Roda em segundo plano: a resposta volta logo e as
  //    categorias aparecem alguns segundos depois (o app recarrega as transações sozinho).
  if (toCategorize.length) {
    const job = categorizeWithAI(supabase, toCategorize.slice(0, AI_LIMIT)).catch((e) => {
      console.error("AI categorization error:", e instanceof Error ? e.message : e);
      return 0;
    });
    runInBackground(job);
  }

  return {
    synced, total, accounts: pluggyAccounts.length, investments, status: itemStatus.status, detail,
    bankUpdatedAt: item.lastUpdatedAt ?? null,
  };
}
