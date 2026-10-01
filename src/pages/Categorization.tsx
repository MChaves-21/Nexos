import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Tags } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSyncedTransactions } from "@/hooks/useBankConnections";
import { CATEGORIES } from "@shared/categorization";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Revisão das categorias sugeridas pela IA/regras. Confirmar ou trocar vira regra. */
const Categorization = () => {
  const { transactions, isLoading, approveCategory } = useSyncedTransactions();
  const [filter, setFilter] = useState<"review" | "all">("review");

  const list = useMemo(() => transactions.filter((t) =>
    filter === "all" || (t.category_source !== "user" && (t.ai_confidence == null || Number(t.ai_confidence) < 0.8 || !t.ai_category)),
  ).slice(0, 300), [transactions, filter]);

  const pending = transactions.filter((t) => t.category_source !== "user" && (t.ai_confidence == null || Number(t.ai_confidence) < 0.8 || !t.ai_category)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categorização</h1>
        <p className="text-muted-foreground text-sm mt-1">Revise as categorias das transações do banco. Cada escolha ensina uma regra.</p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg">{pending} para revisar</CardTitle>
              <CardDescription>Sem categoria ou com baixa confiança da IA</CardDescription>
            </div>
            {/* Filtro com botões (Tabs sem painéis gerava ARIA inválido) */}
            <div className="inline-flex rounded-md bg-muted p-1" role="group" aria-label="Filtrar transações">
              {([["review", "Para revisar"], ["all", "Todas"]] as const).map(([value, label]) => (
                <Button key={value} size="sm" variant={filter === value ? "default" : "ghost"} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : list.length === 0 ? (
            <div className="text-center py-10">
              <Tags className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{transactions.length ? "Tudo revisado." : "Nenhuma transação do banco ainda."}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {list.map((t) => {
                const suggested = t.ai_category || t.original_category;
                const conf = t.ai_confidence != null ? Math.round(Number(t.ai_confidence) * 100) : null;
                return (
                  <li key={t.id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(`${t.date}T12:00`), "dd/MM/yyyy")} · {t.type === "income" ? "+" : "−"}{brl(Number(t.amount))}
                        {conf != null && t.category_source !== "user" && <Badge variant="outline" className="ml-2 text-[10px]">{t.category_source === "rule" ? "regra" : `IA ${conf}%`}</Badge>}
                      </p>
                    </div>
                    <Select
                      value={suggested && CATEGORIES.includes(suggested as never) ? suggested : undefined}
                      onValueChange={(c) => approveCategory.mutate({ id: t.id, category: c })}
                    >
                      <SelectTrigger className="sm:w-44 h-8 text-xs" aria-label="Categoria"><SelectValue placeholder="Escolher categoria" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    {suggested && t.category_source !== "user" && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => approveCategory.mutate({ id: t.id, category: suggested })} aria-label="Confirmar sugestão">
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Categorization;
