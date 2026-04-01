import { useState } from "react";
import { Check, X, Import, Loader2, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSyncedTransactions, type SyncedTransaction } from "@/hooks/useBankConnections";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";

const CATEGORIES = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
  "Lazer", "Vestuário", "Serviços", "Assinaturas", "Compras",
  "Transferência", "Investimento", "Salário", "Freelance", "Outros"
];

const SyncedTransactionsList = () => {
  const { transactions, isLoading, approveCategory, importToTransactions } = useSyncedTransactions();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const pendingTransactions = transactions.filter((t) => !t.is_reviewed);
  const reviewedTransactions = transactions.filter((t) => t.is_reviewed);

  const displayTransactions = showAll ? transactions : pendingTransactions;
  const visibleLimit = 20;
  const [visibleCount, setVisibleCount] = useState(visibleLimit);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === pendingTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingTransactions.map((t) => t.id)));
    }
  };

  const handleImport = () => {
    if (selectedIds.size > 0) {
      importToTransactions.mutate(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    const pct = Math.round(confidence * 100);
    if (pct >= 80) return <Badge className="bg-emerald-500/10 text-emerald-500 text-[10px] px-1.5">{pct}%</Badge>;
    if (pct >= 50) return <Badge className="bg-amber-500/10 text-amber-500 text-[10px] px-1.5">{pct}%</Badge>;
    return <Badge className="bg-red-500/10 text-red-500 text-[10px] px-1.5">{pct}%</Badge>;
  };

  const formatAmount = (amount: number, type: string) => {
    const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
    return type === "income" ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Brain className="h-5 w-5 text-primary" />
              Transações Sincronizadas
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {pendingTransactions.length} pendentes · {reviewedTransactions.length} importadas
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Só pendentes" : "Ver todas"}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importToTransactions.isPending}
                className="gap-1"
              >
                {importToTransactions.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Import className="h-3 w-3" />
                )}
                Importar ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma transação pendente</p>
            <p className="text-xs mt-1">Sincronize um banco para ver transações aqui</p>
          </div>
        ) : (
          <div className="space-y-1">
            {!showAll && pendingTransactions.length > 0 && (
              <div className="flex items-center gap-2 pb-2 border-b mb-2">
                <Checkbox
                  checked={selectedIds.size === pendingTransactions.length && pendingTransactions.length > 0}
                  onCheckedChange={selectAll}
                />
                <span className="text-xs text-muted-foreground">Selecionar todas</span>
              </div>
            )}
            {displayTransactions.slice(0, visibleCount).map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                isSelected={selectedIds.has(tx.id)}
                onToggleSelect={() => toggleSelect(tx.id)}
                onApproveCategory={(category) => approveCategory.mutate({ id: tx.id, category })}
                getConfidenceBadge={getConfidenceBadge}
                formatAmount={formatAmount}
              />
            ))}
            {displayTransactions.length > visibleCount && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setVisibleCount((v) => v + visibleLimit)}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver mais ({displayTransactions.length - visibleCount} restantes)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function TransactionRow({
  transaction: tx,
  isSelected,
  onToggleSelect,
  onApproveCategory,
  getConfidenceBadge,
  formatAmount,
}: {
  transaction: SyncedTransaction;
  isSelected: boolean;
  onToggleSelect: () => void;
  onApproveCategory: (category: string) => void;
  getConfidenceBadge: (c: number | null) => React.ReactNode;
  formatAmount: (a: number, t: string) => string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {!tx.is_reviewed && (
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(tx.date), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-1">
          <Select
            value={tx.ai_category || ""}
            onValueChange={(val) => onApproveCategory(val)}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getConfidenceBadge(tx.ai_confidence)}
        </div>
        <span
          className={`text-sm font-semibold whitespace-nowrap ${
            tx.type === "income" ? "text-emerald-500" : "text-red-500"
          }`}
        >
          {formatAmount(tx.amount, tx.type)}
        </span>
        {tx.is_reviewed && (
          <Badge variant="secondary" className="text-[10px]">
            <Check className="h-3 w-3 mr-0.5" /> Importada
          </Badge>
        )}
      </div>
    </div>
  );
}

export default SyncedTransactionsList;
