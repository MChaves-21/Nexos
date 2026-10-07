// Job diário de avisos: roda no pluggy-sync-all (cron das 06:00) para todas as pessoas.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { localDate } from "./dates.ts";
import { buildNotifications, lastWeekRange, type NewNotification } from "./notifications.ts";
import { errorMessage } from "./http.ts";
import { isMissingRelation } from "./validation.ts";

import { countsInSummary, isSpending } from "./flows.ts";
import { resolveCategory } from "./categorization.ts";
import { findInvestmentSettlements, findOwnTransfers, findReversals, isCardRefund, isRefundDescription, type LedgerRow } from "./ledger.ts";

interface Flow { type: string; amount: number; date: string; category: string }

/** Todas as linhas, em páginas de 1.000 (o PostgREST corta sem avisar). */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

/** Mesmas regras do app (src/lib/mergeTransactions.ts): transferências entre contas próprias e estornos no cartão. */
async function loadFlows(service: SupabaseClient, userId: string, from: string, to: string): Promise<Flow[]> {
  type Synced = {
    id: string; type: string; amount: number; date: string; description: string; ai_category: string | null;
    original_category: string | null; category_source: string | null; bank_account_id: string | null; bank_connection_id: string; source: string;
  };
  const [manual, synced, cards] = await Promise.all([
    allRows<{ type: string; amount: number; date: string; category: string }>((a, b) =>
      service.from("transactions").select("type, amount, date, category").eq("user_id", userId).gte("date", from).lte("date", to).order("id").range(a, b)),
    // Já importadas para transactions (is_reviewed) não contam duas vezes
    allRows<Synced>((a, b) =>
      service.from("synced_transactions")
        .select("id, type, amount, date, description, ai_category, original_category, category_source, bank_account_id, bank_connection_id, source")
        .eq("user_id", userId).eq("is_reviewed", false).gte("date", from).lte("date", to).order("id").range(a, b)),
    service.from("bank_accounts").select("id").eq("user_id", userId).eq("type", "CREDIT"),
  ]);
  const cardIds = new Set(((cards.data ?? []) as Array<{ id: string }>).map((c) => c.id));

  const bankRows: LedgerRow[] = synced.map((t) => ({
    id: t.id,
    type: t.type === "income" ? "income" : "expense",
    amount: Number(t.amount),
    date: t.date,
    description: t.description,
    category: resolveCategory(t.ai_category, t.original_category),
    accountKey: t.bank_account_id ?? `${t.bank_connection_id}:${t.source}`,
    locked: t.category_source === "user",
  }));
  const transfers = findOwnTransfers(bankRows);
  // Reserva de investimento: vale o reservado menos a sobra devolvida
  const settlements = findInvestmentSettlements(bankRows.filter((r) => !transfers.has(r.id)));
  const netByReservation = new Map(settlements.map((s) => [s.reservationId, s.net]));
  const inSettlement = new Set(settlements.flatMap((s) => [s.reservationId, s.returnId]));
  const reversed = findReversals(
    bankRows.filter((r) => !transfers.has(r.id) && !inSettlement.has(r.id) && r.category !== "Transferência" && r.category !== "Investimento"),
  );
  for (const s of settlements) reversed.add(s.returnId);

  return [
    ...manual.map((t) => ({ type: t.type, amount: Number(t.amount), date: t.date, category: t.category })),
    ...bankRows.flatMap((r, i) => {
      // Reembolso total: compra e devolução se anulam
      if (reversed.has(r.id)) return [] as Flow[];
      const net = netByReservation.get(r.id);
      if (net !== undefined) return net > 0 ? [{ type: "expense", amount: net, date: r.date, category: "Investimento" }] : ([] as Flow[]);
      const category = transfers.has(r.id) ? "Transferência" : r.category;
      const isCard = synced[i].source === "csv_card" || (!!synced[i].bank_account_id && cardIds.has(synced[i].bank_account_id!));
      const refund = isCardRefund({ type: r.type, category }, isCard) ||
        (r.type === "income" && category !== "Transferência" && category !== "Investimento" && isRefundDescription(r.description));
      // Estorno/reembolso abate o gasto da categoria
      return [refund
        ? { type: "expense", amount: -r.amount, date: r.date, category }
        : { type: r.type, amount: r.amount, date: r.date, category }];
    }),
  ];
}

/** Lista vazia se a tabela ainda não existir (migração pendente). */
async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return data ?? [];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function sendEmail(to: string, items: NewNotification[]): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  const from = Deno.env.get("NOTIFICATIONS_FROM_EMAIL") ?? "Nexos <onboarding@resend.dev>";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
    <h2 style="color:#223c67">Avisos do Nexos</h2>
    ${items.map((n) => `<p><strong>${escapeHtml(n.title)}</strong><br>${escapeHtml(n.body)}${appUrl ? `<br><a href="${appUrl}${n.link}">Abrir no Nexos</a>` : ""}</p>`).join("")}
    <p style="color:#666;font-size:12px">Você recebe este e-mail porque ativou os avisos por e-mail em Conta e privacidade.</p></div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: items.length === 1 ? items[0].title : `${items.length} avisos do Nexos`, html }),
  });
  if (!resp.ok) console.warn("e-mail de aviso não enviado:", resp.status);
  return resp.ok;
}

export async function runNotifications(service: SupabaseClient, now = new Date()): Promise<{ users: number; created: number; emailed: number }> {
  const today = localDate(now);
  const monthStart = `${today.period}-01`;
  const week = lastWeekRange(today);
  type Profile = { id: string; weekly_summary?: boolean; email_notifications?: boolean };
  // Sem as colunas de preferência (migração pendente), segue com os padrões
  const withPrefs = await service.from("profiles").select("id, weekly_summary, email_notifications");
  const profiles: Profile[] = withPrefs.error
    ? await rows<Profile>(service.from("profiles").select("id"))
    : ((withPrefs.data ?? []) as Profile[]);

  let created = 0;
  let emailed = 0;
  for (const profile of profiles) {
    const userId = profile.id;
    try {
      const [connections, cards, budgets, bills, billPayments, monthFlows, weekFlows] = await Promise.all([
        rows<{ id: string; institution_name: string; status: string; provider: string; consent_expires_at: string | null }>(
          service.from("bank_connections").select("id, institution_name, status, provider, consent_expires_at").eq("user_id", userId)),
        rows<{ id: string; name: string; balance: number; balance_due_date: string | null }>(
          service.from("bank_accounts").select("id, name, balance, balance_due_date").eq("user_id", userId).eq("type", "CREDIT")),
        rows<{ category: string; monthly_budget: number }>(service.from("category_budgets").select("category, monthly_budget").eq("user_id", userId)),
        rows<{ id: string; title: string; amount: number; recurrence: string; due_day: number | null; due_date: string | null; active: boolean }>(
          service.from("bills").select("id, title, amount, recurrence, due_day, due_date, active").eq("user_id", userId)),
        rows<{ bill_id: string; period: string }>(service.from("bill_payments").select("bill_id, period").eq("user_id", userId).eq("period", today.period)),
        loadFlows(service, userId, monthStart, today.iso),
        today.weekday === 1 ? loadFlows(service, userId, week.from, week.to) : Promise.resolve([] as Flow[]),
      ]);

      const spentByCategory: Record<string, number> = {};
      for (const f of monthFlows) {
        // Orçamento é de consumo: aportes e transferências não gastam o limite
        if (f.type !== "expense" || !isSpending(f.category)) continue;
        spentByCategory[f.category] = (spentByCategory[f.category] ?? 0) + f.amount;
      }
      const real = weekFlows.filter((f) => countsInSummary(f.category));
      const lastWeek = {
        income: real.filter((f) => f.type === "income").reduce((s, f) => s + f.amount, 0),
        expense: real.filter((f) => f.type !== "income").reduce((s, f) => s + f.amount, 0),
      };

      const items = buildNotifications({
        today, weeklySummary: profile.weekly_summary ?? true, connections, cards, budgets, spentByCategory, bills, billPayments, lastWeek,
      });
      if (!items.length) continue;

      // Repetidos (mesma dedupe_key) são ignorados pelo banco; voltam só os novos
      const { data: inserted, error } = await service
        .from("notifications")
        .upsert(items.map((n) => ({ ...n, user_id: userId })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select("id, kind, title, body, link, dedupe_key");
      if (error) {
        if (isMissingRelation(error)) return { users: profiles.length, created, emailed };
        throw error;
      }
      created += inserted?.length ?? 0;

      if (inserted?.length && profile.email_notifications) {
        const { data: u } = await service.auth.admin.getUserById(userId);
        const email = u?.user?.email;
        if (email && (await sendEmail(email, inserted as NewNotification[]))) {
          emailed++;
          await service.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", inserted.map((n) => n.id));
        }
      }
    } catch (e) {
      console.error(`avisos falharam para ${userId}:`, errorMessage(e));
    }
  }
  return { users: profiles.length, created, emailed };
}
