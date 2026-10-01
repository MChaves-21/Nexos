import { useMemo, useState } from "react";
import { Download, FileText, HeartPulse, GraduationCap, Landmark, Printer, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useInvestments } from "@/hooks/useInvestments";
import { useSyncedInvestments } from "@/hooks/useBankConnections";
import { buildTaxSummary, type TaxTx } from "@/lib/taxes";
import { neutralizeFormula, toCsv } from "@/lib/csv";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Ajuda para a declaração do Imposto de Renda (resumo do ano). */
const Taxes = () => {
  const thisYear = new Date().getFullYear();
  // A declaração entregue em um ano é sobre o ano anterior
  const [year, setYear] = useState(String(thisYear - 1));
  const { transactions } = useAllTransactions();
  const { investments } = useInvestments();
  const { investments: bankInvestments } = useSyncedInvestments();

  const summary = useMemo(
    () => buildTaxSummary({
      year: Number(year),
      transactions: transactions.map((t): TaxTx => ({ type: t.type, category: t.category, description: t.description, amount: Number(t.amount), date: t.date })),
      manualInvestments: investments,
      bankInvestments: bankInvestments.map((i) => ({ ...i, balance: Number(i.balance), amount_original: i.amount_original != null ? Number(i.amount_original) : null })),
    }),
    [year, transactions, investments, bankInvestments],
  );

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [["Seção", "Data", "Descrição", "Categoria/Tipo", "Valor"]];
    for (const t of summary.deductible.health.items) rows.push(["Despesa médica", dmy(t.date), neutralizeFormula(t.description), t.category, t.amount.toFixed(2)]);
    for (const t of summary.deductible.education.items) rows.push(["Despesa com educação", dmy(t.date), neutralizeFormula(t.description), t.category, t.amount.toFixed(2)]);
    for (const i of summary.income) rows.push(["Rendimento", "", "", i.category, i.total.toFixed(2)]);
    for (const a of summary.assets) rows.push(["Bens e direitos (31/12)", "", neutralizeFormula(a.name), a.type, a.value.toFixed(2)]);
    const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexos-imposto-de-renda-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const section = (icon: typeof HeartPulse, title: string, total: number, description: string, items: TaxTx[]) => {
    const Icon = icon;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" aria-hidden />{title}</span>
            <span className="tabular-nums">{brl(total)}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {items.length > 0 && (
          <CardContent>
            <ul className="divide-y text-sm">
              {items.map((t, i) => (
                <li key={i} className="flex justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{dmy(t.date)} · {t.description}</span>
                  <span className="tabular-nums whitespace-nowrap">{brl(t.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Imposto de Renda</h1>
          <p className="text-muted-foreground text-sm mt-1">Um resumo do ano para facilitar a declaração</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28" aria-label="Ano"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => String(thisYear - i)).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" aria-hidden />CSV</Button>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Imprimir</Button>
        </div>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm flex gap-2">
        <FileText className="h-5 w-5 shrink-0 text-warning" aria-hidden />
        <p>
          Este resumo usa o que está no Nexos (categorias Saúde e Educação, rendimentos e investimentos). Ele <strong>não substitui</strong> os
          informes oficiais do empregador, do banco, da corretora e do plano de saúde, nem um contador. Confira tudo antes de declarar.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {section(HeartPulse, "Despesas médicas", summary.deductible.health.total,
          "Consultas, exames, plano de saúde, dentista, terapia. Dedutíveis sem limite; guarde os recibos com CPF/CNPJ.", summary.deductible.health.items)}
        {section(GraduationCap, "Despesas com educação", summary.deductible.education.total,
          "Escola, faculdade, pós. Têm limite anual por pessoa (confira o valor do ano). Cursos livres e idiomas não entram.", summary.deductible.education.items)}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" aria-hidden />Rendimentos recebidos</span>
            <span className="tabular-nums">{brl(summary.incomeTotal)}</span>
          </CardTitle>
          <CardDescription>Por categoria. O valor oficial do salário está no informe de rendimentos do empregador.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.income.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum rendimento registrado neste ano.</p> : (
            <ul className="divide-y text-sm">
              {summary.income.map((i) => (
                <li key={i.category} className="flex justify-between py-2"><span>{i.category}</span><span className="tabular-nums">{brl(i.total)}</span></li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" aria-hidden />Bens e direitos em 31/12/{year}</span>
            <span className="tabular-nums">{brl(summary.assetsTotal)}</span>
          </CardTitle>
          <CardDescription>
            Na declaração, investimentos entram pelo custo de aquisição, não pelo valor de mercado. Os do banco mostram a posição atual; para
            anos anteriores, use o informe da instituição.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary.assets.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum investimento registrado.</p> : (
            <ul className="divide-y text-sm">
              {summary.assets.map((a, i) => (
                <li key={i} className="flex justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.type}{a.source === "bank" ? " · banco" : ""}</span>
                  </span>
                  <span className="text-right">
                    <span className="block tabular-nums">{brl(a.value)}</span>
                    {a.estimated && <Badge variant="outline" className="text-[10px]">saldo atual, confira o custo</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Taxes;
