import { nubankAccountSource } from "./nubankAccount";
import { nubankCardSource } from "./nubankCard";
import { ofxSource } from "./ofx";
import { ImportFormatError, type NormalizedTransaction, type TransactionSource } from "./types";

export * from "./types";
export { decodeFile } from "./parsing";
export { toSyncedRows } from "./normalize";

// Ordem importa: OFX primeiro (detecção pelo conteúdo), depois os CSVs
export const FILE_SOURCES: TransactionSource[] = [ofxSource, nubankAccountSource, nubankCardSource];

export function detectSource(content: string, fileName: string): TransactionSource {
  const source = FILE_SOURCES.find((s) => s.canParse(content, fileName));
  if (!source) {
    throw new ImportFormatError(
      "Formato não reconhecido. Use a fatura do cartão (CSV), o extrato da conta (CSV) ou um arquivo OFX exportados do app do banco.",
    );
  }
  return source;
}

export function parseImportFile(content: string, fileName: string): { source: TransactionSource; transactions: NormalizedTransaction[] } {
  const source = detectSource(content, fileName);
  return { source, transactions: source.parse(content) };
}
