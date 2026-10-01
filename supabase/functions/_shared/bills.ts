// Contas a pagar: em que dia cada conta vence num mês e se já foi paga. Módulo puro (front e servidor).
import { daysBetween, daysInMonth } from "./dates.ts";

export interface Bill {
  id: string;
  title: string;
  amount: number;
  category?: string | null;
  recurrence: "monthly" | "once" | string;
  due_day: number | null;
  due_date: string | null;
  active: boolean;
}

export interface BillPayment {
  bill_id: string;
  period: string;
}

export type OccurrenceStatus = "paid" | "late" | "due-soon" | "upcoming";

export interface BillOccurrence {
  bill: Bill;
  /** YYYY-MM-DD */
  date: string;
  period: string;
  status: OccurrenceStatus;
  /** Dias até o vencimento a partir de hoje (negativo = atrasada) */
  daysUntil: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Vencimentos do mês (YYYY-MM). Dia 31 em mês de 30 dias vence no último dia. */
export function billOccurrences(bills: Bill[], payments: BillPayment[], period: string, todayIso: string, soonDays = 3): BillOccurrence[] {
  const [year, month] = period.split("-").map(Number);
  const last = daysInMonth(year, month);
  const paid = new Set(payments.filter((p) => p.period === period).map((p) => p.bill_id));

  const out: BillOccurrence[] = [];
  for (const bill of bills) {
    if (!bill.active) continue;
    let date: string | null = null;
    if (bill.recurrence === "monthly" && bill.due_day) date = `${period}-${pad(Math.min(bill.due_day, last))}`;
    else if (bill.recurrence === "once" && bill.due_date?.startsWith(period)) date = bill.due_date.slice(0, 10);
    if (!date) continue;

    const daysUntil = daysBetween(todayIso, date);
    const status: OccurrenceStatus = paid.has(bill.id) ? "paid" : daysUntil < 0 ? "late" : daysUntil <= soonDays ? "due-soon" : "upcoming";
    out.push({ bill, date, period, status, daysUntil });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.bill.title.localeCompare(b.bill.title));
}

export function totalsForPeriod(occurrences: BillOccurrence[]) {
  const sum = (s: OccurrenceStatus[]) => occurrences.filter((o) => s.includes(o.status)).reduce((t, o) => t + Number(o.bill.amount), 0);
  return { total: sum(["paid", "late", "due-soon", "upcoming"]), paid: sum(["paid"]), open: sum(["late", "due-soon", "upcoming"]), late: sum(["late"]) };
}
