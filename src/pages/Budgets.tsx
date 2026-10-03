import { useMemo, useState } from "react";
import { differenceInCalendarMonths, format } from "date-fns";
import { ShieldCheck, Target, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBudgets } from "@/hooks/useBudgets";
import { useGoals } from "@/hooks/useGoals";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useFinancialSnapshot } from "@/hooks/useFinancialSnapshot";
import { CATEGORIES } from "@shared/categorization";
import InfoHint from "@/components/InfoHint";
import TipCard from "@/components/TipCard";
import { isSpendingTx, monthKeyAgo } from "@/lib/insights";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
/** Formata enquanto digita: 1.234,56 */
const maskMoney = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseMoney = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

const Budgets = () => {
  const { budgets, upsertBudget, deleteBudget } = useBudgets();
  const { goals, addGoal, deleteGoal } = useGoals();
  const { transactions } = useAllTransactions();

  const [cat, setCat] = useState("");
  const [limit, setLimit] = useState("");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");

  const month = format(new Date(), "yyyy-MM");
  const spent = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense" || !t.date.startsWith(month)) continue;
      const c = t.category;
      m.set(c, (m.get(c) ?? 0) + Number(t.amount));
    }
    return m;
  }, [transactions, month]);

  // Reserva de emergência sugerida: 6 meses da média de gastos dos últimos 3 meses
  const suggestedReserve = useMemo(() => {
    const now = new Date();
    const months = [1, 2, 3].map((n) => monthKeyAgo(now, n));
    const totals = months.map((m) => transactions
      .filter((t) => isSpendingTx(t) && t.date.startsWith(m))
      .reduce((s, t) => s + Number(t.amount), 0)).filter((v) => v > 0);
    if (!totals.length) return null;
    return Math.round((totals.reduce((s, v) => s + v, 0) / totals.length) * 6 / 100) * 100;
  }, [transactions]);

  const { netWorth } = useFinancialSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Metas e limites</h1>
        <p className="text-muted-foreground text-sm mt-1">Quanto você quer gastar e quanto quer juntar</p>
      </div>

      <TipCard page="budgets" />

      <section className="space-y-4" aria-labelledby="orc">
        <Card>
          <CardHeader>
            <CardTitle id="orc" className="text-base sm:text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" aria-hidden />Limites de gastos do mês<InfoHint term="orcamento" /></CardTitle>
            <CardDescription>Escolha uma categoria e quanto quer gastar nela por mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (!cat || parseMoney(limit) <= 0) return;
              upsertBudget.mutate({ category: cat, monthly_budget: parseMoney(limit) }, { onSuccess: () => { setCat(""); setLimit(""); } });
            }}>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="sm:w-48" aria-label="Categoria"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Input inputMode="numeric" placeholder="Limite mensal (R$)" value={limit} onChange={(e) => setLimit(maskMoney(e.target.value))} aria-label="Limite mensal" />
              <Button type="submit">Salvar</Button>
            </form>
            {budgets.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum limite definido ainda.</p> : (
              <ul className="space-y-3">
                {budgets.map((b) => {
                  const s = spent.get(b.category) ?? 0;
                  const pct = Math.min(100, (s / Number(b.monthly_budget)) * 100);
                  const over = s > Number(b.monthly_budget);
                  const near = !over && pct >= 80;
                  return (
                    <li key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{b.category}</span>
                        <span className={over ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {brl(s)} de {brl(Number(b.monthly_budget))}
                          <Button size="icon" variant="ghost" className="h-7 w-7 ml-1" onClick={() => deleteBudget.mutate(b)} aria-label="Excluir orçamento"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </span>
                      </div>
                      <Progress value={pct} className={over ? "[&>div]:bg-destructive" : near ? "[&>div]:bg-warning" : ""}
                        aria-label={`${b.category}: ${Math.round((s / Number(b.monthly_budget)) * 100)}% do limite`} />
                      {over && <p className="text-xs text-destructive">Passou {brl(s - Number(b.monthly_budget))} do limite.</p>}
                      {near && <p className="text-xs text-muted-foreground">Restam {brl(Number(b.monthly_budget) - s)} para este mês.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="metas">
        <Card>
          <CardHeader>
            <CardTitle id="metas" className="text-base sm:text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" aria-hidden />Metas para juntar dinheiro<InfoHint term="meta" /></CardTitle>
            <CardDescription>Progresso medido pelo seu dinheiro guardado hoje: {brl(netWorth)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || parseMoney(target) <= 0) return;
              addGoal.mutate({ title: title.trim(), description: null, target_amount: parseMoney(target), current_amount: 0, deadline: deadline || null, category: null },
                { onSuccess: () => { setTitle(""); setTarget(""); setDeadline(""); } });
            }}>
              <Input placeholder="Nome da meta" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nome da meta" />
              <Input inputMode="numeric" placeholder="Valor alvo (R$)" value={target} onChange={(e) => setTarget(maskMoney(e.target.value))} aria-label="Valor alvo" />
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Prazo" className="sm:w-44" />
              <Button type="submit">Criar</Button>
            </form>
            {suggestedReserve !== null && !goals.some((g) => /reserva/i.test(g.title)) && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <p className="flex-1">
                  Sugestão: uma <strong>reserva de emergência</strong> de {brl(suggestedReserve)} (6 meses dos seus gastos).
                  <InfoHint term="reserva" className="ml-1" />
                </p>
                <Button size="sm" variant="outline" onClick={() => addGoal.mutate({ title: "Reserva de emergência", description: null, target_amount: suggestedReserve, current_amount: 0, deadline: null, category: null })}>
                  Criar esta meta
                </Button>
              </div>
            )}
            {goals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma meta criada.</p> : (
              <ul className="space-y-3">
                {goals.map((g) => {
                  const pct = Math.max(0, Math.min(100, (netWorth / Number(g.target_amount)) * 100));
                  const missing = Math.max(0, Number(g.target_amount) - netWorth);
                  // Quanto guardar por mês para chegar no prazo
                  const monthsLeft = g.deadline ? differenceInCalendarMonths(new Date(`${g.deadline}T12:00`), new Date()) : null;
                  const perMonth = monthsLeft !== null && monthsLeft > 0 && missing > 0 ? missing / monthsLeft : null;
                  return (
                    <li key={g.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{g.title}{g.deadline && <span className="text-muted-foreground font-normal"> · até {format(new Date(`${g.deadline}T12:00`), "dd/MM/yyyy")}</span>}</span>
                        <span className="text-muted-foreground">
                          {pct.toFixed(0)}% · faltam {brl(missing)}
                          <Button size="icon" variant="ghost" className="h-7 w-7 ml-1" onClick={() => deleteGoal.mutate(g)} aria-label="Excluir meta"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </span>
                      </div>
                      <Progress value={pct} aria-label={`${g.title}: ${pct.toFixed(0)}% da meta`} />
                      {perMonth !== null && <p className="text-xs text-muted-foreground">Guardando {brl(perMonth)} por mês você chega lá no prazo.</p>}
                      {pct >= 100 && <p className="text-xs text-success font-medium">Meta alcançada!</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Budgets;
