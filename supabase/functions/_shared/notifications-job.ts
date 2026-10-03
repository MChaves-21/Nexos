// Job diário de avisos: roda no pluggy-sync-all (cron das 06:00) para todas as pessoas.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { localDate } from "./dates.ts";
import { buildNotifications, lastWeekRange, type NewNotification } from "./notifications.ts";
import { errorMessage } from "./http.ts";
import { isMissingRelation } from "./validation.ts";

import { countsInSummary } from "./flows.ts";

interface Flow { type: string; amount: number; date: string; category: string }

async function loadFlows(service: SupabaseClient, userId: string, from: string, to: string): Promise<Flow[]> {
  const [{ data: manual }, { data: synced }] = await Promise.all([
    service.from("transactions").select("type, amount, date, category").eq("user_id", userId).gte("date", from).lte("date", to),
    // Já importadas para transactions (is_reviewed) não contam duas vezes
    service.from("synced_transactions").select("type, amount, date, ai_category, original_category")
      .eq("user_id", userId).eq("is_reviewed", false).gte("date", from).lte("date", to),
  ]);
  return [
    ...(manual ?? []).map((t) => ({ type: t.type, amount: Number(t.amount), date: t.date, category: t.category })),
    ...(synced ?? []).map((t) => ({ type: t.type, amount: Number(t.amount), date: t.date, category: t.ai_category || t.original_category || "Outros" })),
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
        if (f.type !== "expense" || !countsInSummary(f.category)) continue;
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
