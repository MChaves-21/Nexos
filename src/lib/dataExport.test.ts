import { describe, expect, it } from "vitest";
import { buildExportFile, EXPORT_TABLES, exportFileName } from "./dataExport";

describe("data export (LGPD)", () => {
  it("builds a self-describing file", () => {
    const now = new Date("2026-10-02T10:00:00Z");
    const file = buildExportFile({ id: "u", email: "a@b.com" }, { transactions: [{ id: 1 }] }, ["bills"], now);
    expect(file).toEqual({
      formato: "nexos-export",
      versao: 1,
      gerado_em: "2026-10-02T10:00:00.000Z",
      conta: { id: "u", email: "a@b.com" },
      tabelas: { transactions: [{ id: 1 }] },
      indisponiveis: ["bills"],
    });
    expect(exportFileName(now)).toBe("nexos-meus-dados-2026-10-02.json");
  });

  it("never tries to export stored bank credentials", () => {
    expect(EXPORT_TABLES).not.toContain("pluggy_credentials" as never);
  });
});
