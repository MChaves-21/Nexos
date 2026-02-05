import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Target, TrendingUp, FileDown, Plus, X, GitCompare, Loader2 } from "lucide-react";
import { MarketRateSelector } from "@/components/simulation/MarketRateSelector";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSavedSimulations, SavedSimulation } from "@/hooks/useSavedSimulations";
import { CurrencyInput } from "@/components/ui/currency-input";

const Simulation = () => {
  // Goal-driven projection (valores default)
  const [goalInitialValue, setGoalInitialValue] = useState("0");
  const [goalTarget, setGoalTarget] = useState("100000");
  const [goalYears, setGoalYears] = useState("5");
  const [goalRate, setGoalRate] = useState("10");
  const [goalResult, setGoalResult] = useState<number | null>(null);
  const [goalErrors, setGoalErrors] = useState<{ [key: string]: string }>({});

  // Contribution-driven projection (valores default)
  const [contributionInitialValue, setContributionInitialValue] = useState("1000");
  const [monthlyContribution, setMonthlyContribution] = useState("500");
  const [contributionYears, setContributionYears] = useState("10");
  const [contributionRate, setContributionRate] = useState("10");
  const [contributionResult, setContributionResult] = useState<{
    futureValue: number;
    totalInvested: number;
    earnings: number;
  } | null>(null);
  const [contributionErrors, setContributionErrors] = useState<{ [key: string]: string }>({});

  // Saved simulations from database
  const { 
    simulations: savedSimulations, 
    isLoading, 
    saveSimulation, 
    deleteSimulation, 
    deleteAllSimulations,
    isSaving,
    isDeleting 
  } = useSavedSimulations();

  const validateGoalForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    const target = parseFloat(goalTarget);
    const years = parseFloat(goalYears);
    const rate = parseFloat(goalRate);

    if (!target || target <= 0) {
      errors.target = "Valor desejado deve ser maior que zero";
    }
    if (!years || years <= 0) {
      errors.years = "Prazo deve ser maior que zero";
    }
    if (!rate || rate <= 0) {
      errors.rate = "Taxa deve ser maior que zero";
    }

    setGoalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateContributionForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    const initial = parseFloat(contributionInitialValue);
    const pmt = parseFloat(monthlyContribution);
    const years = parseFloat(contributionYears);
    const rate = parseFloat(contributionRate);

    if ((!initial || initial <= 0) && (!pmt || pmt <= 0)) {
      errors.initial = "Informe um valor inicial ou aporte mensal maior que zero";
      errors.contribution = "Informe um valor inicial ou aporte mensal maior que zero";
    }
    if (!years || years <= 0) {
      errors.years = "Prazo deve ser maior que zero";
    }
    if (!rate || rate <= 0) {
      errors.rate = "Taxa deve ser maior que zero";
    }

    setContributionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const calculateMonthlyContribution = () => {
    if (!validateGoalForm()) return;

    const initial = parseFloat(goalInitialValue) || 0;
    const target = parseFloat(goalTarget);
    const years = parseFloat(goalYears);
    const annualRate = parseFloat(goalRate) / 100;
    const monthlyRate = annualRate / 12;
    const months = years * 12;

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
    if (!validateContributionForm()) return;

    const initial = parseFloat(contributionInitialValue) || 0;
    const pmt = parseFloat(monthlyContribution) || 0;
    const years = parseFloat(contributionYears);
    const annualRate = parseFloat(contributionRate) / 100;
    const monthlyRate = annualRate / 12;
    const months = years * 12;

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
    
    saveSimulation({
      type: "goal",
      name: `Meta ${formatCurrency(parseFloat(goalTarget))} em ${goalYears}a`,
      initial_value: parseFloat(goalInitialValue) || 0,
      target: parseFloat(goalTarget),
      years: parseFloat(goalYears),
      rate: parseFloat(goalRate),
      result: goalResult,
    });
  };

  const saveContributionSimulation = () => {
    if (!contributionResult) return;
    
    saveSimulation({
      type: "contribution",
      name: `${formatCurrency(parseFloat(monthlyContribution))}/mês por ${contributionYears}a`,
      initial_value: parseFloat(contributionInitialValue) || 0,
      monthly_contribution: parseFloat(monthlyContribution),
      years: parseFloat(contributionYears),
      rate: parseFloat(contributionRate),
      result: contributionResult.futureValue,
      total_invested: contributionResult.totalInvested,
      earnings: contributionResult.earnings,
    });
  };

  const removeSimulation = (id: string) => {
    deleteSimulation(id);
  };

  const clearAllSimulations = () => {
    deleteAllSimulations();
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
          formatCurrency(sim.initial_value),
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
          formatCurrency(sim.initial_value),
          formatCurrency(sim.monthly_contribution || 0),
          `${sim.years} anos`,
          `${sim.rate}%`,
          formatCurrency(sim.result),
          formatCurrency(sim.earnings || 0),
        ]),
      });
    }

    doc.save(`comparacao-simulacoes-${date.replace(/\//g, "-")}.pdf`);
  };

  // Generate comparison chart data for all saved simulations
  const comparisonChartData = useMemo(() => {
    if (savedSimulations.length === 0) return [];

    // Find the maximum years among all simulations
    const maxYears = Math.max(...savedSimulations.map(s => s.years));
    
    const data = [];
    
    for (let year = 0; year <= maxYears; year++) {
      const point: Record<string, number | string> = { ano: `Ano ${year}` };
      
      savedSimulations.forEach((sim, index) => {
        if (year > sim.years) {
          // Simulation has ended, keep the final value
          const monthlyRate = sim.rate / 100 / 12;
          const totalMonths = sim.years * 12;
          
          if (sim.type === "contribution") {
            const futureValueOfInitial = sim.initial_value * Math.pow(1 + monthlyRate, totalMonths);
            const pmt = sim.monthly_contribution || 0;
            const futureValueOfContributions = totalMonths > 0 
              ? pmt * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
              : 0;
            point[`sim_${index}`] = Math.round((futureValueOfInitial + futureValueOfContributions) * 100) / 100;
          } else {
            // Goal simulation - show target value after completion
            point[`sim_${index}`] = Math.round((sim.target || 0) * 100) / 100;
          }
        } else {
          const months = year * 12;
          const monthlyRate = sim.rate / 100 / 12;
          
          if (sim.type === "contribution") {
            const futureValueOfInitial = sim.initial_value * Math.pow(1 + monthlyRate, months);
            const pmt = sim.monthly_contribution || 0;
            const futureValueOfContributions = months > 0 
              ? pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
              : 0;
            point[`sim_${index}`] = Math.round((futureValueOfInitial + futureValueOfContributions) * 100) / 100;
          } else {
            // Goal simulation - calculate progress toward target
            const pmt = sim.result;
            const futureValueOfInitial = sim.initial_value * Math.pow(1 + monthlyRate, months);
            const futureValueOfContributions = months > 0 
              ? pmt * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
              : 0;
            point[`sim_${index}`] = Math.round((futureValueOfInitial + futureValueOfContributions) * 100) / 100;
          }
        }
      });
      
      data.push(point);
    }
    
    return data;
  }, [savedSimulations]);

  // Colors for the chart lines
  const chartColors = [
    "hsl(var(--primary))",
    "hsl(var(--success))",
    "hsl(var(--warning))",
    "hsl(var(--destructive))",
    "hsl(200, 70%, 50%)",
    "hsl(280, 70%, 50%)",
    "hsl(320, 70%, 50%)",
    "hsl(40, 70%, 50%)",
  ];

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
                    <CurrencyInput
                      id="goal-initial"
                      placeholder="0"
                      value={goalInitialValue}
                      onChange={(value) => setGoalInitialValue(value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-target">Valor Desejado (R$)</Label>
                    <CurrencyInput
                      id="goal-target"
                      placeholder="100.000"
                      value={goalTarget}
                      onChange={(value) => setGoalTarget(value)}
                      className={goalErrors.target ? "border-destructive" : ""}
                    />
                    {goalErrors.target && (
                      <p className="text-xs text-destructive">{goalErrors.target}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goal-years">Prazo (anos)</Label>
                    <Input
                      id="goal-years"
                      type="number"
                      placeholder="5"
                      value={goalYears}
                      onChange={(e) => setGoalYears(e.target.value)}
                      className={goalErrors.years ? "border-destructive" : ""}
                    />
                    {goalErrors.years && (
                      <p className="text-xs text-destructive">{goalErrors.years}</p>
                    )}
                  </div>
                  <MarketRateSelector
                    id="goal-rate"
                    value={goalRate}
                    onChange={setGoalRate}
                    error={goalErrors.rate}
                  />
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
                    <CurrencyInput
                      id="contribution-initial"
                      placeholder="0"
                      value={contributionInitialValue}
                      onChange={(value) => setContributionInitialValue(value)}
                      className={contributionErrors.initial ? "border-destructive" : ""}
                    />
                    {contributionErrors.initial && (
                      <p className="text-xs text-destructive">{contributionErrors.initial}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly-contribution">Aporte Mensal (R$)</Label>
                    <CurrencyInput
                      id="monthly-contribution"
                      placeholder="500"
                      value={monthlyContribution}
                      onChange={(value) => setMonthlyContribution(value)}
                      className={contributionErrors.contribution ? "border-destructive" : ""}
                    />
                    {contributionErrors.contribution && (
                      <p className="text-xs text-destructive">{contributionErrors.contribution}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contribution-years">Prazo (anos)</Label>
                    <Input
                      id="contribution-years"
                      type="number"
                      placeholder="10"
                      value={contributionYears}
                      onChange={(e) => setContributionYears(e.target.value)}
                      className={contributionErrors.years ? "border-destructive" : ""}
                    />
                    {contributionErrors.years && (
                      <p className="text-xs text-destructive">{contributionErrors.years}</p>
                    )}
                  </div>
                  <MarketRateSelector
                    id="contribution-rate"
                    value={contributionRate}
                    onChange={setContributionRate}
                    error={contributionErrors.rate}
                  />
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
                  <div className="space-y-6">
                    {/* Comparison Chart */}
                    <Card className="border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Evolução Comparativa</CardTitle>
                        <CardDescription>
                          Visualize o crescimento de todas as simulações ao longo do tempo
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[350px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={comparisonChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis 
                                dataKey="ano" 
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                              />
                              <YAxis 
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickFormatter={(value) => formatCurrency(value)}
                              />
                              <Tooltip 
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                }}
                                labelStyle={{ color: "hsl(var(--foreground))" }}
                              />
                              <Legend />
                              {savedSimulations.map((sim, index) => (
                                <Line
                                  key={sim.id}
                                  type="monotone"
                                  dataKey={`sim_${index}`}
                                  stroke={chartColors[index % chartColors.length]}
                                  strokeWidth={2}
                                  name={sim.name}
                                  dot={false}
                                  strokeDasharray={sim.type === "goal" ? "5 5" : undefined}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-4 mt-4 justify-center text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 bg-foreground"></div>
                            <span>Linha sólida = Por Aporte</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-0.5 border-t-2 border-dashed border-foreground"></div>
                            <span>Linha tracejada = Por Meta</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Simulation Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {savedSimulations.map((sim, index) => (
                        <Card key={sim.id} className="relative" style={{ borderColor: chartColors[index % chartColors.length], borderWidth: "2px" }}>
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
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: chartColors[index % chartColors.length] }}
                                />
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
                                  <span className="font-medium">{formatCurrency(sim.initial_value)}</span>
                                </div>
                                
                                {sim.type === "goal" && sim.target && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Meta:</span>
                                    <span className="font-medium">{formatCurrency(sim.target)}</span>
                                  </div>
                                )}
                                
                                {sim.type === "contribution" && sim.monthly_contribution && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Aporte Mensal:</span>
                                    <span className="font-medium">{formatCurrency(sim.monthly_contribution)}</span>
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