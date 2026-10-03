import { useState } from "react";
import { FileDown, Calendar } from "lucide-react";
import { useAllTransactions } from "@/hooks/useAllTransactions";
import { useSyncedInvestments } from "@/hooks/useBankConnections";
import { useBudgets } from "@/hooks/useBudgets";
import { useInvestments } from "@/hooks/useInvestments";
import { useGoals } from "@/hooks/useGoals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { formatBRL, formatDecimal2 } from "@/lib/utils";

const Reports = () => {
  const currentDate = new Date();
  const [startDate, setStartDate] = useState(
    format(startOfMonth(currentDate), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(currentDate), "yyyy-MM-dd")
  );

  // Mesma fonte do Dashboard e de Transações: manuais + banco (sem duplicar as já importadas)
  const { transactions, isLoading: isLoadingTransactions } = useAllTransactions();
  const { budgets, isLoading: isLoadingBudgets } = useBudgets();
  const { investments, isLoading: isLoadingInvestments } = useInvestments();
  const { investments: bankInvestments, isLoading: isLoadingBankInvestments } = useSyncedInvestments();
  const { goals, isLoading: isLoadingGoals } = useGoals();

  const isLoading =
    isLoadingTransactions || isLoadingBudgets || isLoadingInvestments || isLoadingBankInvestments || isLoadingGoals;

  // Datas "YYYY-MM-DD" comparadas como texto: evita o deslocamento de fuso de new Date()
  const filterByDateRange = (date: string) => {
    const day = date.slice(0, 10);
    return day >= startDate && day <= endDate;
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text("Relatório Financeiro Completo", pageWidth / 2, yPosition, {
        align: "center",
      });

      yPosition += 10;
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Período: ${format(parseISO(startDate), "dd/MM/yyyy", {
          locale: ptBR,
        })} até ${format(parseISO(endDate), "dd/MM/yyyy", { locale: ptBR })}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );

      yPosition += 15;

      // Transactions Section
      const filteredTransactions = transactions.filter((t) =>
        filterByDateRange(t.date)
      );

      if (filteredTransactions.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("Transações", 14, yPosition);
        yPosition += 5;

        const transactionsData = filteredTransactions.map((t) => [
          format(parseISO(t.date), "dd/MM/yyyy"),
          t.description,
          t.category,
          t.refund ? "Estorno" : t.type === "income" ? "Receita" : "Despesa",
          t.origin === "bank" ? "Banco" : "Manual",
          formatBRL(Math.abs(t.amount)),
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Data", "Descrição", "Categoria", "Tipo", "Origem", "Valor"]],
          body: transactionsData,
          theme: "striped",
          headStyles: { fillColor: [99, 102, 241] },
          margin: { left: 14, right: 14 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Budgets Section
      if (budgets.length > 0 && yPosition < 250) {
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("Orçamentos por Categoria", 14, yPosition);
        yPosition += 5;

        const budgetsData = budgets.map((b) => {
          const spent = filteredTransactions
            .filter((t) => t.type === "expense" && t.category === b.category)
            .reduce((sum, t) => sum + t.amount, 0);
          const percentage = (spent / b.monthly_budget) * 100;

          return [
            b.category,
            `R$ ${formatDecimal2(b.monthly_budget)}`,
            `R$ ${formatDecimal2(spent)}`,
            `${percentage.toFixed(1)}%`,
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [["Categoria", "Orçamento", "Gasto", "% Utilizado"]],
          body: budgetsData,
          theme: "striped",
          headStyles: { fillColor: [34, 197, 94] },
          margin: { left: 14, right: 14 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Check if we need a new page for investments
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Investments Section
      const filteredInvestments = investments.filter((i) =>
        filterByDateRange(i.purchase_date)
      );

      if (filteredInvestments.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("Investimentos", 14, yPosition);
        yPosition += 5;

        const investmentsData = filteredInvestments.map((inv) => {
          const invested = inv.quantity * inv.purchase_price;
          const current = inv.quantity * inv.current_price;
          const profit = current - invested;
          const profitPercentage = (profit / invested) * 100;

          return [
            inv.asset_name,
            inv.asset_type,
            inv.quantity.toString(),
            `R$ ${formatDecimal2(invested)}`,
            `R$ ${formatDecimal2(current)}`,
            `${profitPercentage > 0 ? "+" : ""}${profitPercentage.toFixed(2)}%`,
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [
            [
              "Ativo",
              "Tipo",
              "Quantidade",
              "Investido",
              "Valor Atual",
              "Rentabilidade",
            ],
          ],
          body: investmentsData,
          theme: "striped",
          headStyles: { fillColor: [234, 179, 8] },
          margin: { left: 14, right: 14 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Bank investments section (posição atual via Open Finance)
      if (bankInvestments.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("Investimentos no banco (posição atual)", 14, yPosition);
        yPosition += 5;

        autoTable(doc, {
          startY: yPosition,
          head: [["Ativo", "Tipo", "Saldo", "Rendimento"]],
          body: bankInvestments.map((inv) => [
            inv.name,
            inv.type,
            `R$ ${formatDecimal2(Number(inv.balance))}`,
            inv.amount_profit == null
              ? "-"
              : `R$ ${formatDecimal2(Number(inv.amount_profit))}`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [234, 179, 8] },
          margin: { left: 14, right: 14 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Check if we need a new page for goals
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Goals Section
      if (goals.length > 0) {
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("Metas Financeiras", 14, yPosition);
        yPosition += 5;

        const goalsData = goals.map((goal) => {
          const progress = (goal.current_amount / goal.target_amount) * 100;
          const remaining = goal.target_amount - goal.current_amount;
          const status = goal.completed ? "Concluída" : "Em andamento";

          return [
            goal.title,
            goal.category || "Geral",
            `R$ ${formatDecimal2(goal.target_amount)}`,
            `R$ ${formatDecimal2(goal.current_amount)}`,
            `${progress.toFixed(1)}%`,
            `R$ ${formatDecimal2(remaining)}`,
            status,
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [
            [
              "Meta",
              "Categoria",
              "Valor Alvo",
              "Valor Atual",
              "Progresso",
              "Faltante",
              "Status",
            ],
          ],
          body: goalsData,
          theme: "striped",
          headStyles: { fillColor: [168, 85, 247] },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
            locale: ptBR,
          })}`,
          14,
          doc.internal.pageSize.getHeight() - 10
        );
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 10,
          { align: "right" }
        );
      }

      // Save PDF
      const fileName = `relatorio-financeiro-${format(
        new Date(),
        "yyyy-MM-dd-HHmm"
      )}.pdf`;
      doc.save(fileName);

      toast({
        title: "Relatório gerado com sucesso!",
        description: `O arquivo ${fileName} foi baixado.`,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Não foi possível gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground mt-1">
          Exporte relatórios completos de suas finanças
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Selecionar Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <div>
                  <h4 className="font-medium">Transações</h4>
                  <p className="text-sm text-muted-foreground">
                    Lista completa de receitas e despesas do período
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-success mt-2"></div>
                <div>
                  <h4 className="font-medium">Orçamentos</h4>
                  <p className="text-sm text-muted-foreground">
                    Resumo dos orçamentos por categoria com percentuais
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-warning mt-2"></div>
                <div>
                  <h4 className="font-medium">Investimentos</h4>
                  <p className="text-sm text-muted-foreground">
                    Portfólio completo com rentabilidade e variação
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-accent mt-2"></div>
                <div>
                  <h4 className="font-medium">Metas Financeiras</h4>
                  <p className="text-sm text-muted-foreground">
                    Progresso das metas com valores e status
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-6">
              <Button
                size="lg"
                className="gap-2"
                onClick={generatePDF}
                disabled={isLoading}
              >
                <FileDown className="h-5 w-5" />
                {isLoading ? "Carregando dados..." : "Gerar Relatório PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transações no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transactions.filter((t) => filterByDateRange(t.date)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orçamentos Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{budgets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Investimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {investments.filter((i) => filterByDateRange(i.purchase_date)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Metas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {goals.filter((g) => !g.completed).length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
