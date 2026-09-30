import { extractInstallment, parseAmount, parseDate } from "./parsing";
import { ImportFormatError, type NormalizedTransaction, type TransactionSource } from "./types";

/** Lê o valor de uma tag OFX, com ou sem tag de fechamento (SGML do OFX 1.x ou XML do 2.x). */
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** Extrato OFX (conta ou cartão). TRNAMT já vem com sinal: negativo = saída. */
export const ofxSource: TransactionSource = {
  source: "ofx",
  label: "Extrato OFX",

  canParse(content, fileName) {
    return /\.ofx$/i.test(fileName) || /OFXHEADER|<OFX>/i.test(content.slice(0, 2000));
  },

  parse(content) {
    const blocks = content.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
    if (!blocks.length && !/<BANKTRANLIST>/i.test(content)) {
      throw new ImportFormatError("Nenhuma transação encontrada no OFX");
    }

    return blocks.map((block, idx): NormalizedTransaction => {
      const rawAmount = tag(block, "TRNAMT");
      const rawDate = tag(block, "DTPOSTED");
      if (!rawAmount || !rawDate) throw new ImportFormatError(`Transação ${idx + 1} sem valor ou data`);
      const description = decodeEntities(tag(block, "MEMO") || tag(block, "NAME") || "Sem descrição");
      return {
        externalId: tag(block, "FITID"),
        date: parseDate(rawDate),
        amount: parseAmount(rawAmount),
        description,
        originalCategory: null,
        installmentInfo: extractInstallment(description),
      };
    });
  },
};
