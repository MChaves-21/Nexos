export type ImportSource = "csv_card" | "csv_account" | "ofx";

/** Transação no formato único usado por todas as fontes (arquivo ou Pluggy). */
export interface NormalizedTransaction {
  /** Id estável vindo da fonte (Identificador do Nubank, FITID do OFX). Ausente => usa hash. */
  externalId?: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** Negativo = saída, positivo = entrada */
  amount: number;
  description: string;
  /** Categoria informada pela própria fonte (ex.: coluna category da fatura) */
  originalCategory?: string | null;
  /** Ex.: "2/5" */
  installmentInfo?: string | null;
}

/** Uma fonte de dados de transações. Pluggy segue o mesmo contrato no backend (_shared/pluggy-mappers.ts). */
export interface TransactionSource {
  source: ImportSource;
  label: string;
  /** Recebe o texto já decodificado e diz se reconhece o formato */
  canParse(content: string, fileName: string): boolean;
  parse(content: string): NormalizedTransaction[];
}

export class ImportFormatError extends Error {}
