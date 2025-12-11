import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Target, TrendingUp, FileDown, Plus, X, GitCompare } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SavedSimulation {
  id: string;
  type: "goal" | "contribution";
  name: string;
  initialValue: number;
  target?: number;
  monthlyContribution?: number;
  years: number;
  rate: number;
  result: number;
  totalInvested?: number;
  earnings?: number;
  createdAt: Date;
}

const Simulation = () => {
  // Goal-driven projection
  const [goalInitialValue, setGoalInitialValue] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalYears, setGoalYears] = useState("");
  const [goalRate, setGoalRate] = useState("10");
  const [goalResult, setGoalResult] = useState<number | null>(null);

  // Contribution-driven projection
  const [contributionInitialValue, setContributionInitialValue] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [contributionYears, setContributionYears] = useState("");
  const [contributionRate, setContributionRate] = useState("10");
  const [contributionResult, setContributionResult] = useState<{
    futureValue: number;
    totalInvested: number;
    earnings: number;
  } | null>(null);

  // Saved simulations for comparison
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);

  const calculateMonthlyContribution = () => {
    const initial = parseFloat(goalInitialValue) || 0;
    const target = parseFloat(goalTarget);
    const years = parseFloat(goalYears);
    const annualRate = parseFloat(goalRate) / 100;
    const monthlyRate = annualRate / 12;
    const months = years * 12;

    if (!target || !years) return;

    // Future value of initial investment
    // FV_initial = PV * (1 + i)^n
    const futureValueOfInitial = initial * Math.pow(1 + monthlyRate, months);
    
    // Remaining amount needed from monthly contributions
    const remainingTarget = target - futureValueOfInitial;
    
    if (remainingTarget <= 0) {
      setGoalResult(0); // Initial investment alone will exceed target
      return;
    }

    // FV = PMT * [((1 + i)^n - 1) / i]
    // PMT = FV / [((1 + i)^n - 1) / i]
    const futureValueFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
    const pmt = remainingTarget / futureValueFactor;

    setGoalResult(Math.max(0, pmt));
  };

  const calculateFutureValue = () => {
    const initial = parseFloat(contributionInitialValue) || 0;
    const pmt = parseFloat(monthlyContribution) || 0;
    const years = parseFloat(contributionYears);
    const annualRate = parseFloat(contributionRate) / 100;
    const monthlyRate = annualRate / 12;
    const months = years * 12;

    if (!years) return;

    // FV = PV * (1 + i)^n + PMT * [((1 + i)^n - 1) / i]
    const futureValueOfInitial = initial * Math.pow(1 + monthlyRate, months);
    const futureValueOfContributions = pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    const futureValue = futureValueOfInitial + futureValueOfContributions;
    
    const totalInvested = initial + (pmt * months);
    const earnings = futureValue - totalInvested;

    setContributionResult({
      futureValue,
      totalInvested,
      earnings
    });
  };

  // Generate projection chart data for contribution mode
  const projectionChartData = useMemo(() => {
    if (!contributionResult) return [];
    
    const initial = parseFloat(contributionInitialValue) || 0;
    const pmt = parseFloat(monthlyContribution) || 0;
    const years = parseFloat(contributionYears);
    const annualRate = parseFloat(contributionRate) / 100;
    const monthlyRate = annualRate / 12;
    
    const data = [];
    
    for (let year = 0; year <= years; year++) {
      const months = year * 12;
      const futureValueOfInitial = initial * Math.pow(1 + monthlyRate, months);
      const futureValueOfContributions = months > 0 
        ? pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        : 0;
      const total = futureValueOfInitial + futureValueOfContributions;
      const invested = initial + (pmt * months);
      
      data.push({
        ano: `Ano ${year}`,
        valorTotal: Math.round(total * 100) / 100,
        totalInvestido: Math.round(invested * 100) / 100,
        rendimentos: Math.round((total - invested) * 100) / 100
      });
    }
    
    return data;
  }, [contributionResult, contributionInitialValue, monthlyContribution, contributionYears, contributionRate]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const exportGoalSimulationPDF = () => {
    if (goalResult === null) return;

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString("pt-BR");

    doc.setFontSize(20);
    doc.text("Simulação por Meta", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${date}`, 14, 28);

    doc.setFontSize(12);
    doc.text("Parâmetros da Simulação", 14, 42);

    autoTable(doc, {
      startY: 48,
      head: [["Parâmetro", "Valor"]],
      body: [
        ["Valor Inicial", formatCurrency(parseFloat(goalInitialValue) || 0)],
        ["Meta Desejada", formatCurrency(parseFloat(goalTarget) || 0)],
        ["Prazo", `${goalYears} anos`],
        ["Taxa Anual", `${goalRate}%`],
      ],
    });

    const finalY = (doc as any).lastAutoTable.finalY || 90;

    doc.setFontSize(14);
    doc.text("Resultado", 14, finalY + 15);
    doc.setFontSize(12);
    
    if (goalResult === 0) {
      doc.text("Seu valor inicial já atingirá a meta!", 14, finalY + 25);
    } else {
      doc.text(`Aporte Mensal Necessário: ${formatCurrency(goalResult)}`, 14, finalY + 25);
    }

    doc.save(`simulacao-meta-${date.replace(/\//g, "-")}.pdf`);
  };

  const exportContributionSimulationPDF = () => {
    if (!contributionResult) return;

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString("pt-BR");

    doc.setFontSize(20);
    doc.text("Simulação por Aporte", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${date}`, 14, 28);

    doc.setFontSize(12);
    doc.text("Parâmetros da Simulação", 14, 42);

    autoTable(doc, {
      startY: 48,
      head: [["Parâmetro", "Valor"]],
      body: [
        ["Valor Inicial", formatCurrency(parseFloat(contributionInitialValue) || 0)],
        ["Aporte Mensal", formatCurrency(parseFloat(monthlyContribution) || 0)],
        ["Prazo", `${contributionYears} anos`],
        ["Taxa Anual", `${contributionRate}%`],
      ],
    });

    let finalY = (doc as any).lastAutoTable.finalY || 90;

    doc.setFontSize(14);
    doc.text("Resultado", 14, finalY + 15);

    autoTable(doc, {
      startY: finalY + 20,
      head: [["Métrica", "Valor"]],
      body: [
        ["Valor Futuro", formatCurrency(contributionResult.futureValue)],
        ["Total Investido", formatCurrency(contributionResult.totalInvested)],
        ["Rendimentos", formatCurrency(contributionResult.earnings)],
      ],
    });

    finalY = (doc as any).lastAutoTable.finalY || 130;

    if (projectionChartData.length > 0) {
      doc.setFontSize(14);
      doc.text("Projeção Anual", 14, finalY + 15);

      autoTable(doc, {
        startY: finalY + 20,
        head: [["Ano", "Valor Total", "Total Investido", "Rendimentos"]],
        body: projectionChartData.map((item) => [
          item.ano,
          formatCurrency(item.valorTotal),
          formatCurrency(item.totalInvestido),
          formatCurrency(item.rendimentos),
        ]),
      });
    }

    doc.save(`simulacao-aporte-${date.replace(/\//g, "-")}.pdf`);
  };

  const saveGoalSimulation = () => {
    if (goalResult === null) return;
    
    const simulation: SavedSimulation = {
      id: Date.now().toString(),
      type: "goal",
      name: `Meta ${formatCurrency(parseFloat(goalTarget))} em ${goalYears}a`,
      initialValue: parseFloat(goalInitialValue) || 0,
      target: parseFloat(goalTarget),
      years: parseFloat(goalYears),
      rate: parseFloat(goalRate),
      result: goalResult,
      createdAt: new Date(),
    };
    
    setSavedSimulations([...savedSimulations, simulation]);
  };

  const saveContributionSimulation = () => {
    if (!contributionResult) return;
    
    const simulation: SavedSimulation = {
      id: Date.now().toString(),
      type: "contribution",
      name: `${formatCurrency(parseFloat(monthlyContribution))}/mês por ${contributionYears}a`,
      initialValue: parseFloat(contributionInitialValue) || 0,
      monthlyContribution: parseFloat(monthlyContribution),
      years: parseFloat(contributionYears),
      rate: parseFloat(contributionRate),
      result: contributionResult.futureValue,
      totalInvested: contributionResult.totalInvested,
      earnings: contributionResult.earnings,
      createdAt: new Date(),
    };
    
    setSavedSimulations([...savedSimulations, simulation]);
  };

  const removeSimulation = (id: string) => {
    setSavedSimulations(savedSimulations.filter(s => s.id !== id));
  };

  const clearAllSimulations = () => {
    setSavedSimulations([]);
  };

  const exportComparisonPDF = () => {
    if (savedSimulations.length === 0) return;

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString("pt-BR");

    doc.setFontSize(20);
    doc.text("Comparação de Simulações", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${date}`, 14, 28);

    const goalSimulations = savedSimulations.filter(s => s.type === "goal");
    const contributionSimulations = savedSimulations.filter(s => s.type === "contribution");

    let currentY = 40;

    if (goalSimulations.length > 0) {
      doc.setFontSize(14);
      doc.text("Simulações por Meta", 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 6,
        head: [["Nome", "Valor Inicial", "Meta", "Prazo", "Taxa", "Aporte Mensal"]],
        body: goalSimulations.map(sim => [
          sim.name,
          formatCurrency(sim.initialValue),
          formatCurrency(sim.target || 0),
          `${sim.years} anos`,
          `${sim.rate}%`,
          formatCurrency(sim.result),
        ]),
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    if (contributionSimulations.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(14);
      doc.text("Simulações por Aporte", 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 6,
        head: [["Nome", "Valor Inicial", "Aporte Mensal", "Prazo", "Taxa", "Valor Futuro", "Rendimentos"]],
        body: contributionSimulations.map(sim => [
          sim.name,
          formatCurrency(sim.initialValue),
          formatCurrency(sim.monthlyContribution || 0),
          `${sim.years} anos`,
          `${sim.rate}%`,
          formatCurrency(sim.result),
          formatCurrency(sim.earnings || 0),
        ]),
      });
    }

    doc.save(`comparacao-simulacoes-${date.replace(/\//g, "-")}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Calculator className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Simulador de Investimentos</h1>
        </div>

        <Tabs defaultValue="goal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="goal" className="gap-2">
              <Target className="h-4 w-4" />
              Por Meta
            </TabsTrigger>
            <TabsTrigger value="contribution" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Por Aporte
            </TabsTrigger>
            <TabsTrigger value="compare" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Comparar ({savedSimulations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="goal" className="mt-6">
            <Card className="border-border/50 shadow-elegant">
              <CardHeader>
                <CardTitle>Projeção Dirigida por Metas</CardTitle>
                <CardDescription>
                  Defina sua meta e descubra quanto precisa investir mensalmente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="goal-initial">Valor Inicial (R$)</Label>
                    <Input
                      id="goal-initial"
                      type="number"
                      placeholder="0"
                      value={goalInitialValue}
                      onChange={(e) => setGoalInitialValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-target">Valor Desejado (R$)</Label>
                    <Input
                      id="goal-target"
                      type="number"
                      placeholder="100000"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-years">Prazo (anos)</Label>
                    <Input
                      id="goal-years"
                      type="number"
                      placeholder="5"
                      value={goalYears}
                      onChange={(e) => setGoalYears(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-rate">Taxa Anual (%)</Label>
                    <Input
                      id="goal-rate"
                      type="number"
                      step="0.1"
                      placeholder="10"
                      value={goalRate}
                      onChange={(e) => setGoalRate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={calculateMonthlyContribution} className="flex-1">
                    Calcular Aporte Mensal
                  </Button>
                  {goalResult !== null && (
                    <>
                      <Button variant="outline" onClick={saveGoalSimulation}>
                        <Plus className="h-4 w-4 mr-2" />
                        Comparar
                      </Button>
                      <Button variant="outline" onClick={exportGoalSimulationPDF}>
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </>
                  )}
                </div>

                {goalResult !== null && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          {goalResult === 0 
                            ? "Seu valor inicial já atingirá a meta!"
                            : "Você precisa investir mensalmente:"}
                        </p>
                        <p className="text-4xl font-bold text-primary">
                          {goalResult.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground mt-4">
                          Para alcançar {parseFloat(goalTarget).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}{" "}
                          em {goalYears} anos com taxa de {goalRate}% ao ano
                        </p>
                        {parseFloat(goalInitialValue) > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Partindo de um valor inicial de{" "}
                            {parseFloat(goalInitialValue).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contribution" className="mt-6 space-y-6">
            <Card className="border-border/50 shadow-elegant">
              <CardHeader>
                <CardTitle>Projeção Dirigida por Aporte</CardTitle>
                <CardDescription>
                  Defina seu aporte mensal e descubra quanto terá no futuro
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="contribution-initial">Valor Inicial (R$)</Label>
                    <Input
                      id="contribution-initial"
                      type="number"
                      placeholder="0"
                      value={contributionInitialValue}
                      onChange={(e) => setContributionInitialValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly-contribution">Aporte Mensal (R$)</Label>
                    <Input
                      id="monthly-contribution"
                      type="number"
                      placeholder="500"
                      value={monthlyContribution}
                      onChange={(e) => setMonthlyContribution(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contribution-years">Prazo (anos)</Label>
                    <Input
                      id="contribution-years"
                      type="number"
                      placeholder="10"
                      value={contributionYears}
                      onChange={(e) => setContributionYears(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contribution-rate">Taxa Anual (%)</Label>
                    <Input
                      id="contribution-rate"
                      type="number"
                      step="0.1"
                      placeholder="10"
                      value={contributionRate}
                      onChange={(e) => setContributionRate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={calculateFutureValue} className="flex-1">
                    Calcular Valor Futuro
                  </Button>
                  {contributionResult && (
                    <>
                      <Button variant="outline" onClick={saveContributionSimulation}>
                        <Plus className="h-4 w-4 mr-2" />
                        Comparar
                      </Button>
                      <Button variant="outline" onClick={exportContributionSimulationPDF}>
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </>
                  )}
                </div>

                {contributionResult !== null && (
                  <Card className="bg-success/5 border-success/20">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Você terá aproximadamente:
                        </p>
                        <p className="text-4xl font-bold text-success">
                          {contributionResult.futureValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Investido</p>
                            <p className="font-semibold">
                              {contributionResult.totalInvested.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Rendimentos</p>
                            <p className="font-semibold text-success">
                              {contributionResult.earnings.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                          {parseFloat(contributionInitialValue) > 0 && (
                            <>Iniciando com {parseFloat(contributionInitialValue).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })} + </>
                          )}
                          {parseFloat(monthlyContribution).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}/mês durante {contributionYears} anos a {contributionRate}% a.a.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Projection Chart */}
            {contributionResult && projectionChartData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Projeção ao Longo do Tempo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={projectionChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="ano" className="text-xs" />
                      <YAxis 
                        className="text-xs" 
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)"
                        }}
                        formatter={(value: number) => [
                          value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        ]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="valorTotal" 
                        stroke="hsl(var(--success))" 
                        strokeWidth={2}
                        name="Valor Total"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalInvestido" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Total Investido"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="rendimentos" 
                        stroke="hsl(var(--warning))" 
                        strokeWidth={2}
                        name="Rendimentos"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="compare" className="mt-6">
            <Card className="border-border/50 shadow-elegant">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Comparação de Simulações</CardTitle>
                    <CardDescription>
                      Compare diferentes cenários de investimento lado a lado
                    </CardDescription>
                  </div>
                  {savedSimulations.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportComparisonPDF}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Exportar PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearAllSimulations}>
                        <X className="h-4 w-4 mr-2" />
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {savedSimulations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Nenhuma simulação para comparar</p>
                    <p className="text-sm mt-2">
                      Faça simulações nas abas "Por Meta" ou "Por Aporte" e clique em "Comparar" para adicioná-las aqui.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {savedSimulations.map((sim) => (
                      <Card key={sim.id} className={`relative ${sim.type === "goal" ? "border-primary/30 bg-primary/5" : "border-success/30 bg-success/5"}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => removeSimulation(sim.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              {sim.type === "goal" ? (
                                <Target className="h-4 w-4 text-primary" />
                              ) : (
                                <TrendingUp className="h-4 w-4 text-success" />
                              )}
                              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {sim.type === "goal" ? "Por Meta" : "Por Aporte"}
                              </span>
                            </div>
                            
                            <p className="font-semibold text-sm truncate">{sim.name}</p>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor Inicial:</span>
                                <span className="font-medium">{formatCurrency(sim.initialValue)}</span>
                              </div>
                              
                              {sim.type === "goal" && sim.target && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Meta:</span>
                                  <span className="font-medium">{formatCurrency(sim.target)}</span>
                                </div>
                              )}
                              
                              {sim.type === "contribution" && sim.monthlyContribution && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Aporte Mensal:</span>
                                  <span className="font-medium">{formatCurrency(sim.monthlyContribution)}</span>
                                </div>
                              )}
                              
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Prazo:</span>
                                <span className="font-medium">{sim.years} anos</span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Taxa:</span>
                                <span className="font-medium">{sim.rate}% a.a.</span>
                              </div>
                            </div>
                            
                            <div className="pt-3 border-t border-border">
                              {sim.type === "goal" ? (
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Aporte Mensal Necessário</p>
                                  <p className="text-xl font-bold text-primary">{formatCurrency(sim.result)}</p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Valor Futuro</p>
                                    <p className="text-xl font-bold text-success">{formatCurrency(sim.result)}</p>
                                  </div>
                                  {sim.earnings && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Rendimentos:</span>
                                      <span className="text-success font-medium">{formatCurrency(sim.earnings)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Simulation;