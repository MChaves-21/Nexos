import { ImportFormatError } from "./types";

/** Parser de CSV com suporte a aspas, detecção de separador (, ou ;) e quebras de linha CRLF. */
export function parseCsv(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

/**
 * Converte valores monetários em número aceitando os formatos brasileiro e internacional:
 * "1.234,56", "1234.56", "-12,5", "R$ 10,00", "(10.00)".
 */
export function parseAmount(raw: string): number {
  let s = raw.replace(/R\$|\s/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  // Dinheiro tem no máximo 2 casas: com um só tipo de separador seguido de exatamente 3 dígitos
  // ("1.234", "12,345,678"), ele é de milhar, não decimal
  const onlyThousands = (sep: "." | ",") => new RegExp(`^[1-9]\\d{0,2}(\\${sep}\\d{3})+$`).test(s);
  if ((lastComma < 0 && onlyThousands(".")) || (lastDot < 0 && onlyThousands(","))) {
    s = s.replace(/[.,]/g, "");
  } else if (lastComma > lastDot) {
    // vírgula é o separador decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  if (s === "" || Number.isNaN(n)) throw new ImportFormatError(`Valor inválido: "${raw}"`);
  return negative ? -n : n;
}

/** Converte "2024-01-15", "15/01/2024" ou "20240115..." (OFX) em "YYYY-MM-DD". */
export function parseDate(raw: string): string {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  throw new ImportFormatError(`Data inválida: "${raw}"`);
}

/** Extrai "2/5" de descrições como "Loja - Parcela 2/5". */
export function extractInstallment(description: string): string | null {
  const m = description.match(/parcela\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
  return m ? `${Number(m[1])}/${Number(m[2])}` : null;
}

/** Normaliza nomes de colunas: minúsculas, sem acento. */
export function normalizeHeader(h: string): string {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Decodifica o arquivo como UTF-8; se não for UTF-8 válido, usa Windows-1252 (comum em OFX de bancos). */
export function decodeFile(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
