import { extractInstallment, normalizeHeader, parseAmount, parseCsv, parseDate } from "./parsing";
import { ImportFormatError, type NormalizedTransaction, type TransactionSource } from "./types";

/**
 * Fatura do cartão Nubank (CSV). Formatos conhecidos:
 *   date,category,title,amount   (antigo)
 *   date,title,amount            (atual)
 * Na fatura, valor positivo é compra (saída) e negativo é pagamento/estorno (entrada).
 */
export const nubankCardSource: TransactionSource = {
  source: "csv_card",
  label: "Fatura do cartão (CSV)",

  canParse(content) {
    const header = parseCsv(content.split(/\r?\n/, 1)[0] ?? "")[0]?.map(normalizeHeader) ?? [];
    return header.includes("date") && header.includes("title") && header.includes("amount");
  },

  parse(content) {
    const [header, ...rows] = parseCsv(content);
    if (!header) throw new ImportFormatError("Arquivo vazio");
    const cols = header.map(normalizeHeader);
    const iDate = cols.indexOf("date");
    const iTitle = cols.indexOf("title");
    const iAmount = cols.indexOf("amount");
    const iCategory = cols.indexOf("category");
    if (iDate < 0 || iTitle < 0 || iAmount < 0) {
      throw new ImportFormatError(`Colunas esperadas: date, title, amount. Encontradas: ${header.join(", ")}`);
    }

    return rows.map((r, idx): NormalizedTransaction => {
      try {
        const description = r[iTitle] ?? "";
        return {
          externalId: null,
          date: parseDate(r[iDate] ?? ""),
          amount: -parseAmount(r[iAmount] ?? ""),
          description,
          originalCategory: iCategory >= 0 ? r[iCategory] || null : null,
          installmentInfo: extractInstallment(description),
        };
      } catch (e) {
        throw new ImportFormatError(`Linha ${idx + 2}: ${(e as Error).message}`);
      }
    });
  },
};
