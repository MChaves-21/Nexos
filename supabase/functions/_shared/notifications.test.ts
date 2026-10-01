import { describe, expect, it } from "vitest";
import { addDays, daysBetween, localDate } from "./dates";
import { billOccurrences, totalsForPeriod, type Bill } from "./bills";
import { buildNotifications, lastWeekRange, type NotificationInput } from "./notifications";

// 05/10/2026 (segunda-feira) às 10h em Brasília = 13h UTC
const monday = localDate(new Date("2026-10-05T13:00:00Z"));

describe("dates", () => {
  it("uses Brasília time, not UTC", () => {
    // 01h UTC do dia 2 ainda é dia 1 em Brasília
    expect(localDate(new Date("2026-10-02T01:00:00Z")).iso).toBe("2026-10-01");
    expect(monday).toMatchObject({ iso: "2026-10-05", period: "2026-10", weekday: 1 });
    expect(daysBetween("2026-10-05", "2026-10-08")).toBe(3);
    expect(addDays("2026-10-05", -7)).toBe("2026-09-28");
  });
});

const bill = (over: Partial<Bill>): Bill => ({ id: "b", title: "Luz", amount: 120, recurrence: "monthly", due_day: 10, due_date: null, active: true, ...over });

describe("billOccurrences", () => {
  it("places monthly bills, clamps day 31 and marks status", () => {
    const occ = billOccurrences(
      [
        bill({ id: "luz", due_day: 7 }),
        bill({ id: "aluguel", title: "Aluguel", due_day: 3, amount: 1500 }),
        bill({ id: "net", title: "Internet", due_day: 31, amount: 100 }),
        bill({ id: "ipva", title: "IPVA", recurrence: "once", due_day: null, due_date: "2026-10-20", amount: 800 }),
        bill({ id: "velha", title: "Inativa", active: false }),
      ],
      [{ bill_id: "aluguel", period: "2026-10" }],
      "2026-10",
      "2026-10-05",
    );
    expect(occ.map((o) => [o.bill.id, o.date, o.status])).toEqual([
      ["aluguel", "2026-10-03", "paid"],
      ["luz", "2026-10-07", "due-soon"],
      ["ipva", "2026-10-20", "upcoming"],
      ["net", "2026-10-31", "upcoming"],
    ]);
    expect(billOccurrences([bill({ due_day: 31 })], [], "2026-02", "2026-02-01")[0].date).toBe("2026-02-28");
    expect(totalsForPeriod(occ)).toEqual({ total: 2520, paid: 1500, open: 1020, late: 0 });
  });

  it("flags late bills", () => {
    const [o] = billOccurrences([bill({ due_day: 2 })], [], "2026-10", "2026-10-05");
    expect(o).toMatchObject({ status: "late", daysUntil: -3 });
  });
});

const input = (over: Partial<NotificationInput> = {}): NotificationInput => ({
  today: monday,
  weeklySummary: true,
  connections: [],
  cards: [],
  budgets: [],
  spentByCategory: {},
  bills: [],
  billPayments: [],
  ...over,
});

describe("buildNotifications", () => {
  it("returns nothing when all is fine", () => {
    expect(buildNotifications(input({ weeklySummary: false }))).toEqual([]);
  });

  it("warns about consent expiring, reauth and sync errors", () => {
    const n = buildNotifications(input({
      weeklySummary: false,
      connections: [
        { id: "c1", institution_name: "Nubank", status: "connected", provider: "pluggy", consent_expires_at: "2026-10-15T00:00:00Z" },
        { id: "c2", institution_name: "Inter", status: "reauth_required", provider: "pluggy", consent_expires_at: null },
        { id: "c3", institution_name: "Itaú", status: "error", provider: "pluggy", consent_expires_at: "2027-09-01" },
        { id: "c4", institution_name: "Arquivo", status: "error", provider: "file", consent_expires_at: null },
      ],
    }));
    expect(n.map((x) => x.dedupe_key)).toEqual(["consent:c1:2026-10-15", "reauth:c2:2026-10", "sync-error:c3:2026-10-05"]);
    expect(n[0].title).toBe("A autorização do Nubank vence em 10 dias");
  });

  it("warns at 80% and over the budget, once per month", () => {
    const n = buildNotifications(input({
      weeklySummary: false,
      budgets: [{ category: "Alimentação", monthly_budget: 1000 }, { category: "Lazer", monthly_budget: 300 }, { category: "Saúde", monthly_budget: 500 }],
      spentByCategory: { Alimentação: 1100, Lazer: 250, Saúde: 100 },
    }));
    expect(n.map((x) => x.dedupe_key)).toEqual(["budget-over:Alimentação:2026-10", "budget-80:Lazer:2026-10"]);
  });

  it("reminds bills due soon or late and card invoices", () => {
    const n = buildNotifications(input({
      weeklySummary: false,
      bills: [bill({ id: "luz", due_day: 6 }), bill({ id: "agua", title: "Água", due_day: 1 })],
      cards: [
        { id: "card1", name: "Nubank", balance: 850, balance_due_date: "2026-10-08" },
        { id: "card2", name: "Zerado", balance: 0, balance_due_date: "2026-10-06" },
      ],
    }));
    expect(n.map((x) => [x.dedupe_key, x.title])).toEqual([
      ["bill-late:agua:2026-10", "Água está atrasada"],
      ["bill:luz:2026-10", "Luz vence amanhã"],
      ["card:card1:2026-10-08", "Fatura do Nubank vence em 3 dias"],
    ]);
  });

  it("sends the weekly summary only on Mondays and when enabled", () => {
    const lastWeek = { income: 5000, expense: 3200 };
    expect(buildNotifications(input({ lastWeek }))[0]).toMatchObject({ kind: "weekly", dedupe_key: "weekly:2026-10-05" });
    expect(buildNotifications(input({ lastWeek, weeklySummary: false }))).toEqual([]);
    const tuesday = localDate(new Date("2026-10-06T13:00:00Z"));
    expect(buildNotifications(input({ lastWeek, today: tuesday }))).toEqual([]);
    expect(lastWeekRange(monday)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });
});
