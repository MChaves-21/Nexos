import { useMemo } from "react";
import { Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import InfoHint from "@/components/InfoHint";
import { useMarketRates } from "@/hooks/useMarketRates";
import { compareWithBenchmarks } from "@/lib/benchmarks";
import type { Investment } from "@/hooks/useInvestments";

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Compara a carteira manual com o CDI e a inflação no mesmo período. */
const BenchmarkCard = ({ investments }: { investments: Investment[] }) => {
  const { rates } = useMarketRates();

  const result = useMemo(
    () =>
      compareWithBenchmarks(
        investments.map((i) => ({
          invested: Number(i.quantity) * Number(i.purchase_price),
          current: Number(i.quantity) * Number(i.current_price),
          purchaseDate: i.purchase_date,
        })),
        { cdi: rates.cdi, ipca: rates.ipca },
      ),
    [investments, rates],
  );

  if (!result) return null;

  const rows = [
    { label: "Sua carteira", value: result.returnPct, strong: true },
    { label: "CDI no período", value: result.cdiPct, hint: "cdi" as const },
    { label: "Inflação no período", value: result.ipcaPct, hint: "ipca" as const },
  ];
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.01);
  const months = Math.max(1, Math.round(result.years * 12));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Scale className="h-5 w-5 text-primary" aria-hidden />Sua carteira vs CDI e inflação
          <InfoHint term="rentabilidade" />
        </CardTitle>
        <CardDescription>
          Tempo médio aplicado: {months} {months === 1 ? "mês" : "meses"}. Estimativa com as taxas atuais
          {rates.source === "bcb" ? " do Banco Central" : " (aproximadas)"}: CDI {rates.cdi.toLocaleString("pt-BR")}% ao ano, inflação{" "}
          {rates.ipca.toLocaleString("pt-BR")}% em 12 meses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className={r.strong ? "font-medium" : "text-muted-foreground"}>
                  {r.label}
                  {r.hint && <InfoHint term={r.hint} className="ml-0.5" />}
                </span>
                <span className={r.strong ? "font-semibold" : ""}>{pct(r.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden>
                <div
                  className={r.strong ? (r.value >= 0 ? "h-full bg-success" : "h-full bg-destructive") : "h-full bg-muted-foreground/50"}
                  style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          {result.beatsInflation
            ? "Seus investimentos renderam mais que a inflação: seu dinheiro ganhou poder de compra."
            : "Seus investimentos renderam menos que a inflação: seu dinheiro perdeu poder de compra no período."}
          {result.pctOfCdi !== null && ` Isso equivale a ${Math.round(result.pctOfCdi)}% do CDI.`}
        </p>
      </CardContent>
    </Card>
  );
};

export default BenchmarkCard;
