import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Target, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBudgets } from "@/hooks/useBudgets";
import { useGoals } from "@/hooks/useGoals";
import { useBankConnections, useSyncedInvestments, useSyncedTransactions } from "@/hooks/useBankConnections";
import { CATEGORIES } from "@shared/categorization";

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
  const { accounts } = useBankConnections();
  const { transactions } = useSyncedTransactions();
  const { investments } = useSyncedInvestments();

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
      const c = t.ai_category || t.original_category || "Outros";
      m.set(c, (m.get(c) ?? 0) + Number(t.amount));
    }
    return m;
  }, [transactions, month]);

  const netWorth = useMemo(() =>
    accounts.reduce((s, a) => s + (a.type === "CREDIT" ? -Math.abs(Number(a.balance)) : Number(a.balance)), 0) +
    investments.reduce((s, i) => s + Number(i.balance), 0), [accounts, investments]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Metas e orçamentos</h1>
        <p className="text-muted-foreground text-sm mt-1">Progresso calculado com os dados reais do banco</p>
      </div>

      <section className="space-y-4" aria-labelledby="orc">
        <Card>
          <CardHeader>
            <CardTitle id="orc" className="text-base sm:text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Orçamentos do mês</CardTitle>
            <CardDescription>Gasto do mês atual por categoria, vindo das transações do banco</CardDescription>
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
            {budgets.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum orçamento definido.</p> : (
              <ul className="space-y-3">
                {budgets.map((b) => {
                  const s = spent.get(b.category) ?? 0;
                  const pct = Math.min(100, (s / Number(b.monthly_budget)) * 100);
                  const over = s > Number(b.monthly_budget);
                  return (
                    <li key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{b.category}</span>
                        <span className={over ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {brl(s)} de {brl(Number(b.monthly_budget))}
                          <Button size="icon" variant="ghost" className="h-7 w-7 ml-1" onClick={() => deleteBudget.mutate(b)} aria-label="Excluir orçamento"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </span>
                      </div>
                      <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />
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
            <CardTitle id="metas" className="text-base sm:text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Metas</CardTitle>
            <CardDescription>Progresso em relação ao seu patrimônio real: {brl(netWorth)}</CardDescription>
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
            {goals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma meta criada.</p> : (
              <ul className="space-y-3">
                {goals.map((g) => {
                  const pct = Math.max(0, Math.min(100, (netWorth / Number(g.target_amount)) * 100));
                  const missing = Math.max(0, Number(g.target_amount) - netWorth);
                  return (
                    <li key={g.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{g.title}{g.deadline && <span className="text-muted-foreground font-normal"> · até {format(new Date(`${g.deadline}T12:00`), "dd/MM/yyyy")}</span>}</span>
                        <span className="text-muted-foreground">
                          {pct.toFixed(0)}% · faltam {brl(missing)}
                          <Button size="icon" variant="ghost" className="h-7 w-7 ml-1" onClick={() => deleteGoal.mutate(g)} aria-label="Excluir meta"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </span>
                      </div>
                      <Progress value={pct} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default Budgets;
