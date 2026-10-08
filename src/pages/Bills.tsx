import { useMemo, useState } from "react";
import { addMonths, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, Plus, Trash2, Undo2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useBills } from "@/hooks/useBills";
import { useBankConnections } from "@/hooks/useBankConnections";
import { billOccurrences, totalsForPeriod, type BillOccurrence, type OccurrenceStatus } from "@shared/bills";
import { CATEGORIES } from "@shared/categorization";
import { cn } from "@/lib/utils";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const STATUS: Record<OccurrenceStatus, { label: string; className: string }> = {
  paid: { label: "Paga", className: "bg-success/10 text-success border-success/30" },
  late: { label: "Atrasada", className: "bg-destructive/10 text-destructive border-destructive/30" },
  "due-soon": { label: "Vence logo", className: "bg-warning/10 text-amber-700 dark:text-amber-400 border-warning/40" },
  upcoming: { label: "A vencer", className: "bg-muted text-muted-foreground" },
};
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Contas a pagar: cadastro, calendário do mês e marcar como paga. */
const Bills = () => {
  const [month, setMonth] = useState(() => new Date());
  const period = format(month, "yyyy-MM");
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const { bills, payments, addBill, removeBill, setPaid, unavailable } = useBills(period);
  const { accounts } = useBankConnections();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [recurrence, setRecurrence] = useState<"monthly" | "once">("monthly");
  const [dueDay, setDueDay] = useState("10");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<string>("Moradia");

  const occurrences = useMemo(
    () => billOccurrences(bills.map((b) => ({ ...b, amount: Number(b.amount) })), payments, period, todayIso),
    [bills, payments, period, todayIso],
  );
  const totals = totalsForPeriod(occurrences);
  // Faturas de cartão do mês entram no calendário (só leitura)
  const cardDues = accounts.filter((a) => a.type === "CREDIT" && a.balance_due_date?.startsWith(period) && Number(a.balance) > 0);

  const byDay = useMemo(() => {
    const map = new Map<number, Array<{ label: string; status?: OccurrenceStatus }>>();
    for (const o of occurrences) {
      const d = Number(o.date.slice(8, 10));
      map.set(d, [...(map.get(d) ?? []), { label: o.bill.title, status: o.status }]);
    }
    for (const c of cardDues) {
      const d = Number(c.balance_due_date!.slice(8, 10));
      map.set(d, [...(map.get(d) ?? []), { label: `Fatura ${c.name}` }]);
    }
    return map;
  }, [occurrences, cardDues]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthTitle = (() => {
    const s = format(month, "MMMM 'de' yyyy", { locale: ptBR });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount) || 0;
    if (!title.trim()) return;
    addBill.mutate(
      {
        title: title.trim(),
        amount: value,
        category,
        recurrence,
        due_day: recurrence === "monthly" ? Number(dueDay) : null,
        due_date: recurrence === "once" ? dueDate : null,
      },
      { onSuccess: () => { setTitle(""); setAmount(""); } },
    );
  };

  const row = (o: BillOccurrence) => (
    <li key={`${o.bill.id}-${o.date}`} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium flex items-center gap-2 flex-wrap">
          {o.bill.title}
          <Badge variant="outline" className={cn("text-[10px]", STATUS[o.status].className)}>{STATUS[o.status].label}</Badge>
          {o.bill.recurrence === "monthly" && <span className="text-xs text-muted-foreground">todo mês</span>}
        </p>
        <p className="text-xs text-muted-foreground">Vence {o.date.split("-").reverse().join("/")}{o.bill.category ? ` · ${o.bill.category}` : ""}</p>
      </div>
      <span className="font-semibold tabular-nums">{brl(Number(o.bill.amount))}</span>
      <div className="flex gap-1">
        {o.status === "paid" ? (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setPaid.mutate({ bill: bills.find((b) => b.id === o.bill.id)!, paid: false })}>
            <Undo2 className="h-4 w-4" aria-hidden />Desfazer
          </Button>
        ) : (
          <Button size="sm" className="gap-1" onClick={() => setPaid.mutate({ bill: bills.find((b) => b.id === o.bill.id)!, paid: true })}>
            <Check className="h-4 w-4" aria-hidden />Marcar como paga
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeBill.mutate(o.bill.id)} aria-label={`Apagar ${o.bill.title}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contas a pagar</h1>
        <p className="text-muted-foreground text-sm mt-1">Cadastre suas contas e receba um aviso 3 dias antes de vencer</p>
      </div>

      {unavailable && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">As contas a pagar ainda não estão disponíveis: o banco do app precisa da atualização mais recente.</CardContent></Card>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
        <h2 className="text-lg font-semibold" aria-live="polite">{monthTitle}</h2>
        <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" aria-hidden /></Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total do mês</p><p className="text-lg font-bold tabular-nums">{brl(totals.total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Já pago</p><p className="text-lg font-bold text-success tabular-nums">{brl(totals.paid)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Falta pagar</p><p className={cn("text-lg font-bold tabular-nums", totals.late > 0 && "text-destructive")}>{brl(totals.open)}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" aria-hidden />Calendário</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid grid-cols-7 gap-1 text-center text-xs" aria-label={`Vencimentos de ${monthTitle}`}>
              {WEEKDAYS.map((d, i) => <li key={`w${i}`} className="font-medium text-muted-foreground py-1" aria-hidden>{d}</li>)}
              {cells.map((day, i) => {
                if (!day) return <li key={i} aria-hidden />;
                const items = byDay.get(day) ?? [];
                const isToday = `${period}-${String(day).padStart(2, "0")}` === todayIso;
                const worst = items.some((x) => x.status === "late") ? "late" : items.some((x) => x.status === "due-soon") ? "due-soon" : items.length ? "upcoming" : null;
                return (
                  <li key={i} className={cn("aspect-square rounded-md border flex flex-col items-center justify-center gap-0.5", isToday && "border-primary border-2")}>
                    <span aria-hidden>{day}</span>
                    <span className="sr-only">{`Dia ${day}${isToday ? " (hoje)" : ""}: ${items.length ? items.map((x) => x.label).join(", ") : "sem vencimentos"}`}</span>
                    {worst && <span className={cn("h-1.5 w-1.5 rounded-full", worst === "late" ? "bg-destructive" : worst === "due-soon" ? "bg-warning" : "bg-primary")} aria-hidden />}
                  </li>
                );
              })}
            </ul>
            {cardDues.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs">
                {cardDues.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" aria-hidden />Fatura {c.name}: {brl(Number(c.balance))} vence {c.balance_due_date!.slice(8, 10)}/{c.balance_due_date!.slice(5, 7)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contas de {monthTitle.toLowerCase()}</CardTitle></CardHeader>
          <CardContent>
            {occurrences.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma conta neste mês. Cadastre abaixo.</p>
            ) : (
              <ul className="divide-y">{occurrences.map(row)}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4 text-primary" aria-hidden />Nova conta</CardTitle>
          <CardDescription>Luz, água, aluguel, escola, internet... Contas de todo mês ou de uma vez só (como IPVA).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="bill-title">Nome</Label>
              <Input id="bill-title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Conta de luz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill-amount">Valor (R$)</Label>
              <CurrencyInput id="bill-amount" value={amount} onChange={setAmount} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill-recurrence">Repete?</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as "monthly" | "once")}>
                <SelectTrigger id="bill-recurrence"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Todo mês</SelectItem>
                  <SelectItem value="once">Uma vez</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recurrence === "monthly" ? (
              <div className="space-y-1.5">
                <Label htmlFor="bill-day">Dia do vencimento</Label>
                <Input id="bill-day" type="number" min={1} max={31} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="bill-date">Data do vencimento</Label>
                <Input id="bill-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bill-category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="bill-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="lg:col-start-6"
              disabled={!title.trim() || addBill.isPending || (recurrence === "monthly" ? !(Number(dueDay) >= 1 && Number(dueDay) <= 31) : !dueDate)}>
              Cadastrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Bills;
