import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import InfoHint from "@/components/InfoHint";
import { useBankConnections, useSyncedTransactions } from "@/hooks/useBankConnections";
import { limitUsage, projectInstallments } from "@/lib/cards";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const dayMonth = (iso: string | null) => (iso ? format(new Date(`${iso}T12:00`), "dd/MM", { locale: ptBR }) : "—");
const monthLabel = (period: string) => {
  const s = format(new Date(`${period}-15T12:00`), "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Cartões: fatura atual, vencimento, limite e parcelas que ainda vão cair. */
const Cards = () => {
  const { accounts, connections } = useBankConnections();
  const { transactions } = useSyncedTransactions();
  const cards = accounts.filter((a) => a.type === "CREDIT");

  const future = useMemo(() => {
    const cardIds = new Set(cards.map((c) => c.id));
    const fileCardConnections = new Set(
      transactions.filter((t) => t.source === "csv_card").map((t) => t.bank_connection_id),
    );
    const txs = transactions
      .filter((t) => (t.bank_account_id && cardIds.has(t.bank_account_id)) || fileCardConnections.has(t.bank_connection_id))
      .map((t) => ({
        date: t.date,
        amount: Number(t.amount),
        description: t.description,
        installment_info: t.installment_info,
        type: t.type,
        cardKey: t.bank_account_id ?? t.bank_connection_id,
      }));
    return projectInstallments(txs, format(new Date(), "yyyy-MM"), 6);
  }, [cards, transactions]);

  const cardName = (key: string) =>
    cards.find((c) => c.id === key)?.name ?? connections.find((c) => c.id === key)?.institution_name ?? "Cartão";
  const maxFuture = Math.max(...future.map((m) => m.total), 1);
  const hasFuture = future.some((m) => m.total > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cartões</h1>
        <p className="text-muted-foreground text-sm mt-1">Fatura atual, vencimento e parcelas que ainda vão cair</p>
      </div>

      {cards.length === 0 && !hasFuture ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Conecte o banco do seu cartão ou importe a fatura (CSV) para ver os detalhes aqui.</p>
            <Button asChild><Link to="/open-finance">Conectar banco</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => {
            const usage = limitUsage(c.credit_limit != null ? Number(c.credit_limit) : null, c.available_credit_limit != null ? Number(c.available_credit_limit) : null);
            return (
              <Card key={c.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" aria-hidden />{c.name}
                    {c.card_brand && <Badge variant="outline" className="text-[10px]">{c.card_brand}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Fatura atual</p>
                      <p className="text-2xl font-bold tabular-nums">{brl(Number(c.balance))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Vencimento</p>
                      <p className="font-semibold flex items-center gap-1 justify-end"><CalendarClock className="h-4 w-4" aria-hidden />{dayMonth(c.balance_due_date)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fecha em {dayMonth(c.balance_close_date)}
                    {c.minimum_payment != null && ` · pagamento mínimo ${brl(Number(c.minimum_payment))}`}
                  </p>
                  {usage !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Limite usado</span>
                        <span>{brl(Number(c.credit_limit) - Number(c.available_credit_limit))} de {brl(Number(c.credit_limit))}</span>
                      </div>
                      <Progress value={usage} aria-label={`Limite usado: ${Math.round(usage)}%`} className={usage > 80 ? "[&>div]:bg-warning" : ""} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasFuture && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-1">Parcelas nas próximas faturas<InfoHint term="previsao" /></CardTitle>
            <CardDescription>Compras parceladas que ainda vão cair. Ajuda a não se comprometer além do que dá.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {future.map((m) => (
                <li key={m.period} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{monthLabel(m.period)}</span>
                    <span className="tabular-nums">{brl(m.total)}</span>
                  </div>
                  <Progress value={(m.total / maxFuture) * 100} aria-label={`${monthLabel(m.period)}: ${brl(m.total)} em parcelas`} />
                  {m.items.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none">{m.items.length} parcela{m.items.length > 1 ? "s" : ""}</summary>
                      <ul className="mt-1 space-y-0.5 pl-3">
                        {m.items.map((i, idx) => (
                          <li key={idx} className="flex justify-between gap-2">
                            <span className="truncate">{i.description} ({i.installment}) · {cardName(i.cardKey)}</span>
                            <span className="tabular-nums whitespace-nowrap">{brl(i.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Cards;
