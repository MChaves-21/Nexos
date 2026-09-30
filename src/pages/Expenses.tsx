import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSyncedTransactions } from "@/hooks/useBankConnections";
import { CATEGORIES } from "@shared/categorization";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Transações lidas direto do banco; mudar a categoria cria uma regra para as próximas. */
const Expenses = () => {
  const { transactions, isLoading, approveCategory } = useSyncedTransactions();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)));
    set.add(format(new Date(), "yyyy-MM"));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => transactions.filter((t) =>
    (month === "all" || t.date.startsWith(month)) &&
    (type === "all" || t.type === type) &&
    (!search || t.description.toLowerCase().includes(search.toLowerCase())),
  ), [transactions, month, type, search]);

  const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Transações</h1>
        <p className="text-muted-foreground text-sm mt-1">Entradas e saídas das suas contas conectadas</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-success">{brl(income)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-lg font-bold text-destructive">{brl(expense)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo</p><p className="text-lg font-bold">{brl(income - expense)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base sm:text-lg">{filtered.length} transações</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar descrição" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar" />
            </div>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="sm:w-44" aria-label="Mês"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {months.map((m) => <SelectItem key={m} value={m}>{format(new Date(`${m}-15`), "MMMM yyyy", { locale: ptBR })}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="sm:w-36" aria-label="Tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="income">Entradas</SelectItem>
                <SelectItem value="expense">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Receipt className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma transação do banco ainda.</p>
              <Button asChild><Link to="/open-finance">Conectar ou sincronizar banco</Link></Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nada encontrado com esses filtros.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((t) => {
                const category = t.ai_category || t.original_category || "Outros";
                return (
                  <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.description}{t.installment_info && <span className="text-muted-foreground"> ({t.installment_info})</span>}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(`${t.date}T12:00`), "dd/MM/yyyy")}
                        {t.category_source && <Badge variant="outline" className="ml-2 text-[10px]">{t.category_source === "user" ? "você" : t.category_source === "rule" ? "regra" : "IA"}</Badge>}
                      </p>
                    </div>
                    <Select value={CATEGORIES.includes(category as never) ? category : undefined} onValueChange={(c) => approveCategory.mutate({ id: t.id, category: c })}>
                      <SelectTrigger className="sm:w-40 h-8 text-xs" aria-label="Categoria"><SelectValue placeholder={category} /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className={`sm:w-28 text-right font-semibold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                      {t.type === "income" ? "+" : "−"}{brl(Number(t.amount))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Expenses;
