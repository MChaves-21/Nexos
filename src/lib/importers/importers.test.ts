import { describe, expect, it } from "vitest";
import { parseImportFile, splitPluggyDuplicates, toSyncedRows } from "./index";
import { parseAmount, parseCsv, parseDate, extractInstallment, decodeFile } from "./parsing";

// Todos os dados abaixo são fictícios.
const CARD_CSV = `date,category,title,amount
2026-08-01,restaurante,Ifood *Restaurante Ficticio,45.90
2026-08-03,transporte,Uber *Trip,18.25
2026-08-05,eletronico,Loja Exemplo - Parcela 2/5,199.99
2026-08-10,,Pagamento recebido,-500.00
2026-08-12,restaurante,"Padaria ""Pão Quente""",12.00
2026-08-12,restaurante,"Padaria ""Pão Quente""",12.00
`;

const CARD_CSV_NEW = `date,title,amount
2026-09-02,Netflix.Com,55.90
2026-09-04,Estorno de compra,-30.00
`;

const ACCOUNT_CSV = `\uFEFFData,Valor,Identificador,Descrição
01/08/2026,3500.00,11111111-aaaa-bbbb-cccc-000000000001,Transferência recebida - Empresa Ficticia LTDA
02/08/2026,-1200.50,11111111-aaaa-bbbb-cccc-000000000002,Pagamento de boleto efetuado - Aluguel
03/08/2026,-89.90,11111111-aaaa-bbbb-cccc-000000000003,Compra no débito - Farmacia Exemplo
`;

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<DTSTART>20260801000000[-3:BRT]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260805000000[-3:BRT]
<TRNAMT>-150.75
<FITID>abc-001
<MEMO>Supermercado Ficticio &amp; Cia
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260806120000[-3:BRT]
<TRNAMT>1000.00
<FITID>abc-002
<MEMO>Pix recebido
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe("parsing helpers", () => {
  it("parses brazilian and international amounts", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("-12,5")).toBe(-12.5);
    expect(parseAmount("1234.56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("R$ 10,00")).toBe(10);
    expect(parseAmount("(10.00)")).toBe(-10);
    expect(() => parseAmount("abc")).toThrow();
  });

  it("parses dates", () => {
    expect(parseDate("2026-08-01")).toBe("2026-08-01");
    expect(parseDate("15/01/2026")).toBe("2026-01-15");
    expect(parseDate("20260805000000[-3:BRT]")).toBe("2026-08-05");
  });

  it("extracts installments", () => {
    expect(extractInstallment("Loja - Parcela 2/5")).toBe("2/5");
    expect(extractInstallment("parcela 10 / 12")).toBe("10/12");
    expect(extractInstallment("Compra 12/08")).toBeNull();
  });

  it("parses quoted CSV fields and semicolon delimiter", () => {
    expect(parseCsv('a,b\n"x, y","z ""q"""')).toEqual([["a", "b"], ["x, y", 'z "q"']]);
    expect(parseCsv("a;b\r\n1,5;2\r\n")).toEqual([["a", "b"], ["1,5", "2"]]);
  });

  it("decodes windows-1252 when not utf-8", () => {
    const latin1 = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f]); // "Descrição"
    expect(decodeFile(latin1.buffer)).toBe("Descrição");
  });
});

describe("Nubank card CSV", () => {
  it("detects and normalizes signs (purchase = saída)", () => {
    const { source, transactions } = parseImportFile(CARD_CSV, "fatura.csv");
    expect(source.source).toBe("csv_card");
    expect(transactions).toHaveLength(6);
    expect(transactions[0]).toMatchObject({ date: "2026-08-01", amount: -45.9, originalCategory: "restaurante" });
    expect(transactions[2].installmentInfo).toBe("2/5");
    expect(transactions[3].amount).toBe(500); // pagamento da fatura entra no cartão
    expect(transactions[4].description).toBe('Padaria "Pão Quente"');
  });

  it("supports the format without category", () => {
    const { source, transactions } = parseImportFile(CARD_CSV_NEW, "fatura.csv");
    expect(source.source).toBe("csv_card");
    expect(transactions[0]).toMatchObject({ amount: -55.9, originalCategory: null });
    expect(transactions[1].amount).toBe(30); // estorno
  });
});

describe("Nubank account CSV", () => {
  it("uses Identificador and keeps the sign", () => {
    const { source, transactions } = parseImportFile(ACCOUNT_CSV, "extrato.csv");
    expect(source.source).toBe("csv_account");
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toMatchObject({ date: "2026-08-01", amount: 3500, externalId: "11111111-aaaa-bbbb-cccc-000000000001" });
    expect(transactions[1].amount).toBe(-1200.5);
  });
});

describe("OFX", () => {
  it("parses SGML OFX", () => {
    const { source, transactions } = parseImportFile(OFX_SGML, "extrato.ofx");
    expect(source.source).toBe("ofx");
    expect(transactions).toEqual([
      expect.objectContaining({ externalId: "abc-001", date: "2026-08-05", amount: -150.75, description: "Supermercado Ficticio & Cia" }),
      expect.objectContaining({ externalId: "abc-002", date: "2026-08-06", amount: 1000 }),
    ]);
  });

  it("parses XML OFX (closing tags)", () => {
    const xml = `<?xml version="1.0"?><OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260901</DTPOSTED><TRNAMT>-9.99</TRNAMT><FITID>x1</FITID><NAME>Spotify</NAME></STMTTRN></BANKTRANLIST></OFX>`;
    const { transactions } = parseImportFile(xml, "a.ofx");
    expect(transactions).toEqual([expect.objectContaining({ externalId: "x1", amount: -9.99, description: "Spotify" })]);
  });
});

describe("unknown format", () => {
  it("throws a helpful error", () => {
    expect(() => parseImportFile("foo,bar\n1,2", "x.csv")).toThrow(/Formato não reconhecido/);
  });
});

describe("toSyncedRows (dedup + categorização)", () => {
  it("produces the same ids when the same file is imported twice", async () => {
    const { transactions } = parseImportFile(CARD_CSV, "fatura.csv");
    const a = await toSyncedRows(transactions, { source: "csv_card", accountKey: "Nubank Cartão" });
    const b = await toSyncedRows(transactions, { source: "csv_card", accountKey: "Nubank Cartão" });
    expect(a.map((r) => r.external_id)).toEqual(b.map((r) => r.external_id));
  });

  it("keeps two identical purchases on the same day as distinct rows", async () => {
    const { transactions } = parseImportFile(CARD_CSV, "fatura.csv");
    const rows = await toSyncedRows(transactions, { source: "csv_card", accountKey: "Nubank Cartão" });
    expect(new Set(rows.map((r) => r.external_id)).size).toBe(rows.length);
  });

  it("changes the hash when the account changes", async () => {
    const { transactions } = parseImportFile(CARD_CSV, "fatura.csv");
    const a = await toSyncedRows(transactions.slice(0, 1), { source: "csv_card", accountKey: "Conta A" });
    const b = await toSyncedRows(transactions.slice(0, 1), { source: "csv_card", accountKey: "Conta B" });
    expect(a[0].hash).not.toBe(b[0].hash);
  });

  it("uses the source id when available and maps type/amount", async () => {
    const { transactions } = parseImportFile(ACCOUNT_CSV, "extrato.csv");
    const rows = await toSyncedRows(transactions, { source: "csv_account", accountKey: "Nubank Conta" });
    expect(rows[0]).toMatchObject({ external_id: "id:11111111-aaaa-bbbb-cccc-000000000001", type: "income", amount: 3500 });
    expect(rows[1]).toMatchObject({ type: "expense", amount: 1200.5, ai_category: "Moradia", category_source: "rule" });
  });

  it("applies user rules before default rules", async () => {
    const { transactions } = parseImportFile(CARD_CSV, "fatura.csv");
    const rows = await toSyncedRows(transactions, {
      source: "csv_card",
      accountKey: "Nubank Cartão",
      userRules: [{ keyword: "uber trip", category: "Lazer" }],
    });
    expect(rows[0].ai_category).toBe("Alimentação"); // regra padrão (ifood)
    expect(rows[1].ai_category).toBe("Lazer"); // regra do usuário
    expect(rows[2]).toMatchObject({ ai_category: null, category_source: null, installment_info: "2/5" });
  });
});

describe("splitPluggyDuplicates (arquivo x Pluggy)", () => {
  const row = (date: string, amount: number, description: string, type = "expense") => ({ date, amount, type, description });

  it("skips a file row already synced from Pluggy with similar description", () => {
    const { rows, duplicates } = splitPluggyDuplicates(
      [row("2026-08-01", 45.9, "Ifood *Restaurante Ficticio"), row("2026-08-01", 10, "Padaria Central")],
      [{ date: "2026-08-01", amount: "45.90", type: "expense", description: "IFOOD *RESTAURANTE", accountType: "CREDIT" }],
      "csv_card",
    );
    expect(duplicates.map((r) => r.description)).toEqual(["Ifood *Restaurante Ficticio"]);
    expect(rows.map((r) => r.description)).toEqual(["Padaria Central"]);
  });

  it("keeps rows with same date/value but different description", () => {
    const { rows } = splitPluggyDuplicates(
      [row("2026-08-01", 10, "Padaria Central")],
      [{ date: "2026-08-01", amount: 10, type: "expense", description: "Uber Trip", accountType: "CREDIT" }],
      "csv_card",
    );
    expect(rows).toHaveLength(1);
  });

  it("ignores Pluggy transactions from another account type", () => {
    const { rows } = splitPluggyDuplicates(
      [row("2026-08-01", 10, "Uber Trip")],
      [{ date: "2026-08-01", amount: 10, type: "expense", description: "Uber Trip", accountType: "BANK" }],
      "csv_card",
    );
    expect(rows).toHaveLength(1);
  });

  it("each Pluggy transaction matches at most one file row", () => {
    const { rows, duplicates } = splitPluggyDuplicates(
      [row("2026-08-01", 10, "Uber Trip"), row("2026-08-01", 10, "Uber Trip")],
      [{ date: "2026-08-01", amount: 10, type: "expense", description: "UBER *TRIP", accountType: null }],
      "csv_card",
    );
    expect(duplicates).toHaveLength(1);
    expect(rows).toHaveLength(1);
  });
});
