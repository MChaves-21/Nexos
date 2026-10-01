import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { decodeFile, parseImportFile, type ImportSource, type NormalizedTransaction } from "@/lib/importers";
import { useFileImport } from "@/hooks/useFileImport";

const DEFAULT_ACCOUNT_NAME: Record<ImportSource, string> = {
  csv_card: "Nubank - Cartão",
  csv_account: "Nubank - Conta",
  ofx: "Nubank - Conta (OFX)",
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Preview {
  fileName: string;
  source: ImportSource;
  sourceLabel: string;
  transactions: NormalizedTransaction[];
}

const FileImportDialog = () => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [accountName, setAccountName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const fileImport = useFileImport();

  const reset = () => {
    setPreview(null);
    setAccountName("");
    setParseError(null);
  };

  const handleFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setParseError("Arquivo maior que 5 MB.");
      return;
    }
    try {
      const content = decodeFile(await file.arrayBuffer());
      const { source, transactions } = parseImportFile(content, file.name);
      if (!transactions.length) throw new Error("Nenhuma transação encontrada no arquivo.");
      setPreview({ fileName: file.name, source: source.source, sourceLabel: source.label, transactions });
      setAccountName(DEFAULT_ACCOUNT_NAME[source.source]);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    await fileImport.mutateAsync({ accountName, source: preview.source, transactions: preview.transactions });
    reset();
    setOpen(false);
  };

  const summary = preview
    ? (() => {
        const dates = preview.transactions.map((t) => t.date).sort();
        const out = preview.transactions.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
        const inc = preview.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        return { from: dates[0], to: dates[dates.length - 1], out, inc };
      })()
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 w-full sm:w-auto">
          <FileUp className="h-4 w-4" />
          Importar arquivo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar extrato ou fatura</DialogTitle>
          <DialogDescription>
            No app do Nubank, exporte a fatura do cartão (CSV) ou o extrato da conta (CSV ou OFX). O arquivo é lido no
            seu navegador; reimportar o mesmo arquivo não duplica lançamentos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="import-file">Arquivo (.csv ou .ofx)</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.ofx,text/csv,application/x-ofx"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{parseError}</AlertDescription>
            </Alert>
          )}

          {preview && summary && (
            <>
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <p className="font-medium">{preview.sourceLabel}</p>
                <p className="text-muted-foreground text-xs">
                  {preview.transactions.length} lançamentos · {summary.from.split("-").reverse().join("/")} a{" "}
                  {summary.to.split("-").reverse().join("/")}
                </p>
                <p className="text-xs">
                  <span className="text-red-600 dark:text-red-400">Saídas {formatCurrency(summary.out)}</span> ·{" "}
                  <span className="text-emerald-700 dark:text-emerald-400">Entradas {formatCurrency(summary.inc)}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-account">Conta</Label>
                <Input id="import-account" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">
                  Use sempre o mesmo nome para a mesma conta; é ele que evita duplicatas entre importações.
                </p>
              </div>
              <Button
                onClick={handleImport}
                disabled={!accountName.trim() || fileImport.isPending}
                className="w-full gap-2"
              >
                {fileImport.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {preview.transactions.length} lançamentos
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileImportDialog;
