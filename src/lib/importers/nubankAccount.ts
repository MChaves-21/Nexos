import { extractInstallment, normalizeHeader, parseAmount, parseCsv, parseDate } from "./parsing";
import { ImportFormatError, type NormalizedTransaction, type TransactionSource } from "./types";

/** Extrato da conta Nubank (CSV): Data,Valor,Identificador,Descrição. Valor já vem com sinal. */
export const nubankAccountSource: TransactionSource = {
  source: "csv_account",
  label: "Extrato da conta (CSV)",

  canParse(content) {
    const header = parseCsv(content.split(/\r?\n/, 1)[0] ?? "")[0]?.map(normalizeHeader) ?? [];
    return header.includes("data") && header.includes("valor") && header.includes("descricao");
  },

  parse(content) {
    const [header, ...rows] = parseCsv(content);
    if (!header) throw new ImportFormatError("Arquivo vazio");
    const cols = header.map(normalizeHeader);
    const iDate = cols.indexOf("data");
    const iAmount = cols.indexOf("valor");
    const iId = cols.indexOf("identificador");
    const iDesc = cols.indexOf("descricao");
    if (iDate < 0 || iAmount < 0 || iDesc < 0) {
      throw new ImportFormatError(`Colunas esperadas: Data, Valor, Descrição. Encontradas: ${header.join(", ")}`);
    }

    return rows.map((r, idx): NormalizedTransaction => {
      try {
        const description = r[iDesc] ?? "";
        return {
          externalId: iId >= 0 ? r[iId] || null : null,
          date: parseDate(r[iDate] ?? ""),
          amount: parseAmount(r[iAmount] ?? ""),
          description,
          originalCategory: null,
          installmentInfo: extractInstallment(description),
        };
      } catch (e) {
        throw new ImportFormatError(`Linha ${idx + 2}: ${(e as Error).message}`);
      }
    });
  },
};
