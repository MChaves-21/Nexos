// Exportação CSV segura.

/**
 * Texto vindo do usuário ou do banco que começa com = + - @ (ou tab/CR) é interpretado
 * como fórmula pelo Excel/Sheets ("CSV injection"). Prefixar com ' faz virar texto.
 */
export function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Célula entre aspas, com aspas internas duplicadas (RFC 4180). */
export function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
