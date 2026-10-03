import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Preço unitário em reais; abaixo de R$ 1 mostra mais casas (ex.: cripto a R$ 0,00008123). */
export function formatUnitPrice(price: number): string {
  const digits = Math.abs(price) > 0 && Math.abs(price) < 1 ? 8 : 2;
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: digits });
}

/**
 * Texto para busca "contém" (ilike) no Supabase. Escapa os curingas % e _ e remove *, que o
 * PostgREST também trata como curinga: uma regra "50%" não pode casar com todas as transações.
 */
export function containsPattern(text: string): string {
  const escaped = text.replace(/\*/g, "").replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

/** Só caminhos internos do app (ex.: "/bills"); bloqueia "//site.com", "/\\site.com" e URLs completas. */
export function isInternalPath(link: string | null | undefined): link is string {
  return typeof link === "string" && /^\/(?![/\\])[^\s]*$/.test(link);
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DECIMAL_2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 1.234,56": sempre 2 casas (toLocaleString só com minimumFractionDigits pode mostrar 3). */
export function formatBRL(value: number): string {
  return BRL.format(Number(value) || 0);
}

/** "1.234,56" sem o símbolo, sempre com 2 casas. */
export function formatDecimal2(value: number): string {
  return DECIMAL_2.format(Number(value) || 0);
}
