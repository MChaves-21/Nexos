// Regras dos avisos diários. Módulo puro: recebe os dados de uma pessoa e devolve os avisos a criar.
// Cada aviso tem uma dedupe_key; o banco ignora repetidos, então rodar de novo no mesmo dia não duplica.
import { billOccurrences, type Bill, type BillPayment } from "./bills.ts";
import { addDays, daysBetween, type LocalDate } from "./dates.ts";

export interface NewNotification {
  kind: string;
  title: string;
  body: string;
  link: string;
  dedupe_key: string;
}

export interface NotificationInput {
  today: LocalDate;
  weeklySummary: boolean;
  connections: Array<{ id: string; institution_name: string; status: string; provider: string; consent_expires_at: string | null }>;
  cards: Array<{ id: string; name: string; balance: number; balance_due_date: string | null }>;
  budgets: Array<{ category: string; monthly_budget: number }>;
  /** Gastos do mês atual por categoria (transferências e aplicações já excluídas) */
  spentByCategory: Record<string, number>;
  bills: Bill[];
  billPayments: BillPayment[];
  /** Entradas e saídas da semana anterior (segunda a domingo), para o resumo semanal */
  lastWeek?: { income: number; expense: number };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function buildNotifications(input: NotificationInput): NewNotification[] {
  const { today } = input;
  const out: NewNotification[] = [];

  for (const c of input.connections) {
    if (c.provider !== "pluggy") continue;
    if (c.status === "reauth_required") {
      out.push({
        kind: "reauth",
        title: `Reconecte o ${c.institution_name}`,
        body: "A autorização do Open Finance precisa ser renovada para continuar sincronizando. Toque em Reconectar e aprove no app do banco.",
        link: "/open-finance",
        dedupe_key: `reauth:${c.id}:${today.period}`,
      });
    } else if (c.status === "error") {
      out.push({
        kind: "sync-error",
        title: `Não conseguimos sincronizar o ${c.institution_name}`,
        body: "Tentaremos de novo amanhã. Se continuar, abra Conectar banco e toque em Sincronizar.",
        link: "/open-finance",
        dedupe_key: `sync-error:${c.id}:${today.iso}`,
      });
    }
    if (c.consent_expires_at && c.status !== "reauth_required") {
      const days = daysBetween(today.iso, c.consent_expires_at.slice(0, 10));
      if (days >= 0 && days <= 15) {
        out.push({
          kind: "consent",
          title: `A autorização do ${c.institution_name} vence em ${days} dia${days === 1 ? "" : "s"}`,
          body: "Renove antes para não parar de sincronizar: em Conectar banco, toque em Reconectar e aprove no app do banco.",
          link: "/open-finance",
          dedupe_key: `consent:${c.id}:${c.consent_expires_at.slice(0, 10)}`,
        });
      }
    }
  }

  for (const b of input.budgets) {
    const limit = Number(b.monthly_budget);
    const spent = input.spentByCategory[b.category] ?? 0;
    if (limit <= 0) continue;
    if (spent > limit) {
      out.push({
        kind: "budget",
        title: `Você passou do limite de ${b.category}`,
        body: `Gastou ${brl(spent)} de ${brl(limit)} este mês.`,
        link: "/budgets",
        dedupe_key: `budget-over:${b.category}:${today.period}`,
      });
    } else if (spent >= limit * 0.8) {
      out.push({
        kind: "budget",
        title: `${b.category}: 80% do limite usado`,
        body: `Gastou ${brl(spent)} de ${brl(limit)}. Restam ${brl(limit - spent)} para o mês.`,
        link: "/budgets",
        dedupe_key: `budget-80:${b.category}:${today.period}`,
      });
    }
  }

  for (const o of billOccurrences(input.bills, input.billPayments, today.period, today.iso)) {
    if (o.status === "due-soon") {
      const when = o.daysUntil === 0 ? "vence hoje" : o.daysUntil === 1 ? "vence amanhã" : `vence em ${o.daysUntil} dias`;
      out.push({
        kind: "bill",
        title: `${o.bill.title} ${when}`,
        body: `Valor: ${brl(Number(o.bill.amount))}. Depois de pagar, marque como paga em Contas a pagar.`,
        link: "/bills",
        dedupe_key: `bill:${o.bill.id}:${o.period}`,
      });
    } else if (o.status === "late") {
      out.push({
        kind: "bill",
        title: `${o.bill.title} está atrasada`,
        body: `Venceu em ${o.date.split("-").reverse().join("/")}. Se já pagou, marque como paga em Contas a pagar.`,
        link: "/bills",
        dedupe_key: `bill-late:${o.bill.id}:${o.period}`,
      });
    }
  }

  for (const card of input.cards) {
    if (!card.balance_due_date || Number(card.balance) <= 0) continue;
    const days = daysBetween(today.iso, card.balance_due_date);
    if (days >= 0 && days <= 3) {
      out.push({
        kind: "card",
        title: `Fatura do ${card.name} ${days === 0 ? "vence hoje" : `vence em ${days} dia${days === 1 ? "" : "s"}`}`,
        body: `Valor da fatura: ${brl(Number(card.balance))}.`,
        link: "/cards",
        dedupe_key: `card:${card.id}:${card.balance_due_date}`,
      });
    }
  }

  // Segunda-feira: resumo da semana anterior
  if (input.weeklySummary && today.weekday === 1 && input.lastWeek && (input.lastWeek.income > 0 || input.lastWeek.expense > 0)) {
    const { income, expense } = input.lastWeek;
    const balance = income - expense;
    out.push({
      kind: "weekly",
      title: "Seu resumo da semana",
      body: `Entrou ${brl(income)} e saiu ${brl(expense)}. ${balance >= 0 ? `Sobraram ${brl(balance)}.` : `Faltaram ${brl(-balance)}.`}`,
      link: "/",
      dedupe_key: `weekly:${today.iso}`,
    });
  }

  return out;
}

/** Período da semana anterior (segunda a domingo) a partir de uma segunda-feira. */
export function lastWeekRange(today: LocalDate): { from: string; to: string } {
  return { from: addDays(today.iso, -7), to: addDays(today.iso, -1) };
}
