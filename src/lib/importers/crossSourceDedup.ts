import { normalizeText } from "@shared/categorization";
import type { ImportSource } from "./types";

export interface PluggyCandidate {
  date: string;
  amount: number | string;
  type: string;
  description: string;
  /** Tipo da conta na Pluggy (BANK | CREDIT), quando conhecido */
  accountType: string | null;
}

export interface FileRowLike {
  date: string;
  amount: number;
  type: string;
  description: string;
}

/** Palavras relevantes da descrição (3+ letras, sem números). */
function tokens(description: string): Set<string> {
  return new Set(
    normalizeText(description)
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w)),
  );
}

function sharesToken(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/** Fatura do cartão casa com contas de crédito da Pluggy; extrato (CSV/OFX) com contas correntes. */
export function expectedAccountType(source: ImportSource): "CREDIT" | "BANK" {
  return source === "csv_card" ? "CREDIT" : "BANK";
}

/**
 * Separa as linhas do arquivo que já vieram pela Pluggy.
 * Uma linha só é considerada duplicata quando há uma transação Pluggy com a mesma data, valor e tipo,
 * do mesmo tipo de conta, e com pelo menos uma palavra em comum na descrição.
 * Cada transação Pluggy "consome" no máximo uma linha do arquivo.
 */
export function splitPluggyDuplicates<T extends FileRowLike>(
  rows: T[],
  pluggy: PluggyCandidate[],
  source: ImportSource,
): { rows: T[]; duplicates: T[] } {
  const accountType = expectedAccountType(source);
  const pool = new Map<string, Array<{ tokens: Set<string>; used: boolean }>>();
  for (const p of pluggy) {
    if (p.accountType && p.accountType !== accountType) continue;
    const key = `${p.date}|${Number(p.amount).toFixed(2)}|${p.type}`;
    const list = pool.get(key) ?? [];
    list.push({ tokens: tokens(p.description), used: false });
    pool.set(key, list);
  }

  const kept: T[] = [];
  const duplicates: T[] = [];
  for (const r of rows) {
    const candidates = pool.get(`${r.date}|${r.amount.toFixed(2)}|${r.type}`);
    const rowTokens = tokens(r.description);
    const match = candidates?.find((c) => !c.used && sharesToken(c.tokens, rowTokens));
    if (match) {
      match.used = true;
      duplicates.push(r);
    } else {
      kept.push(r);
    }
  }
  return { rows: kept, duplicates };
}
