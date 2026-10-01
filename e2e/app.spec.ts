import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { fixtures, mockSupabase, USER_ID, type MockOptions } from "./mock-supabase";

const isMobile = (name: string) => name === "mobile";

test.describe("Investimentos", () => {
  test("posições do banco entram nos totais e na carteira, sem edição", async ({ page, context }) => {
    await mockSupabase(context);
    await page.goto("/investments");
    // Valor atual = PETR4 (100 × 36) + BBAS3 (2.644,80) + CDB (1.100); posição zerada fica de fora
    await expect(page.getByText("R$ 7.344,80").first()).toBeVisible();
    await expect(page.getByText("BBAS3").first()).toBeVisible();
    await expect(page.getByText("Resgatado")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Editar PETR4" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar BBAS3" })).toHaveCount(0);
    await expect(page.getByText("Atualizado pelo banco").first()).toBeVisible();
  });
});

test.describe("Tratamento de erros", () => {
  test("modo completo funciona mesmo se o banco ainda não tiver a coluna de preferência", async ({ page, context }, info) => {
    const missingColumn = { status: 400, body: { code: "PGRST204", message: "Could not find the 'ui_mode' column of 'profiles' in the schema cache" } };
    await mockSupabase(context, { tables: fixtures({ uiMode: "simple" }), failTables: { profiles: missingColumn } });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
    if (isMobile(info.project.name)) await page.getByRole("button", { name: "Mais" }).click();
    await page.getByRole("switch", { name: /Modo completo/ }).filter({ visible: true }).click();
    await expect(page.getByText("Não foi possível salvar a preferência")).toHaveCount(0);
    await expect(page.getByText(/Mostrando investimentos/).filter({ visible: true })).toBeVisible();
    // A escolha fica guardada no navegador até a migração ser aplicada
    await page.reload();
    if (isMobile(info.project.name)) await page.getByRole("button", { name: "Mais" }).click();
    await expect(page.getByRole("switch", { name: /Modo completo/ }).filter({ visible: true })).toBeChecked();
  });

  test("falha ao carregar mostra aviso amigável e a página continua funcionando", async ({ page, context }) => {
    await mockSupabase(context, { failTables: { synced_transactions: { status: 500, body: { message: "internal: connection reset by peer" } } } });
    await page.goto("/");
    await expect(page.getByText("Não foi possível carregar os dados").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Algo deu errado. Tente novamente em instantes.").first()).toBeVisible();
    await expect(page.getByText(/connection reset/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
  });

  test("sem internet mostra aviso", async ({ page, context }) => {
    await mockSupabase(context);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByText("Você está sem internet")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("Você está sem internet")).toHaveCount(0);
  });

  test("tela que não carrega mostra mensagem em vez de página em branco", async ({ page, context }) => {
    await mockSupabase(context);
    await context.route("**/src/pages/Reports.tsx*", (route) => route.abort());
    await page.goto("/reports");
    await expect(page.getByRole("alert").getByText("Ops, algo deu errado nesta tela")).toBeVisible();
    await expect(page.getByRole("button", { name: "Recarregar página" })).toBeVisible();
  });
});

test.describe("Primeiro acesso", () => {
  test("aparece para conta nova e salva a escolha", async ({ page, context }) => {
    const writes: MockOptions["writes"] = [];
    await mockSupabase(context, { tables: fixtures({ uiMode: "simple", onboardingCompleted: false }), writes });
    await page.goto("/");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Bem-vindo ao Nexos")).toBeVisible();
    await dialog.getByRole("button", { name: /Completo/ }).click();
    await expect(dialog.getByText("Traga suas transações")).toBeVisible();
    await dialog.getByRole("button", { name: "Pular" }).click();
    await expect(dialog).toHaveCount(0);
    const profileWrites = writes!.filter((w) => w.table === "profiles").map((w) => w.body);
    expect(profileWrites).toContainEqual(expect.objectContaining({ id: USER_ID, ui_mode: "complete" }));
    expect(profileWrites).toContainEqual(expect.objectContaining({ id: USER_ID, onboarding_completed: true }));
  });
});

test.describe("Segurança no app", () => {
  test("exportação CSV neutraliza fórmulas vindas do banco", async ({ page, context }, info) => {
    test.skip(isMobile(info.project.name), "download testado no desktop");
    const tables = fixtures();
    tables.synced_transactions.push({
      ...(tables.synced_transactions[0] as object),
      id: "00000000-0000-4000-8000-999999999999",
      description: '=HYPERLINK("http://golpe.example","Clique")',
    });
    await mockSupabase(context, { tables });
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar CSV" }).click()]);
    const csv = fs.readFileSync(await download.path(), "utf8");
    expect(csv).toContain(`"'=HYPERLINK(""http://golpe.example"",""Clique"")"`);
    expect(csv).not.toMatch(/(^|,)"=HYPERLINK/m);
  });
});

test.describe("Acessibilidade", () => {
  for (const path of ["/", "/expenses", "/budgets", "/open-finance", "/investments", "/simulation"]) {
    test(`sem violações WCAG A/AA em ${path}`, async ({ page, context }) => {
      await mockSupabase(context);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});
