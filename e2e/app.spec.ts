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
  for (const path of ["/", "/expenses", "/budgets", "/open-finance", "/investments", "/simulation", "/bills", "/cards", "/taxes", "/family", "/account", "/privacy"]) {
    test(`sem violações WCAG A/AA em ${path}`, async ({ page, context }) => {
      await mockSupabase(context);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    });
  }
});

test.describe("Conta Pluggy própria (família)", () => {
  test("salva as credenciais sem mostrá-las de volta", async ({ page, context }) => {
    const calls: Array<Record<string, unknown>> = [];
    let configured = false;
    await mockSupabase(context, {
      functions: (name, body) => {
        if (name !== "pluggy-connect") return {};
        calls.push(body);
        if (body.action === "save-credentials") configured = true;
        return configured ? { configured: true, clientId: "••••9f0e" } : { configured: false };
      },
    });
    await page.goto("/open-finance");
    await page.getByRole("button", { name: /usar uma conta Pluggy própria/ }).click();
    await expect(page.getByText("Hoje esta conta usa a conta Pluggy do app.")).toBeVisible();
    await page.getByLabel("Client ID").fill("cliente-familia-9f0e");
    await page.getByLabel("Client Secret").fill("segredo-super-secreto");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(/Usando a sua conta Pluggy \(Client ID ••••9f0e\)/)).toBeVisible();
    await expect(page.getByLabel("Client Secret")).toHaveValue("");
    expect(calls).toContainEqual(expect.objectContaining({ action: "save-credentials", clientId: "cliente-familia-9f0e", clientSecret: "segredo-super-secreto" }));
    await expect(page.getByText("segredo-super-secreto")).toHaveCount(0);
  });
});

test.describe("Contas a pagar", () => {
  test("mostra as contas do mês e marca como paga", async ({ page, context }) => {
    const writes: MockOptions["writes"] = [];
    await mockSupabase(context, { writes });
    await page.goto("/bills");
    await expect(page.getByRole("heading", { name: "Contas a pagar" })).toBeVisible();
    await expect(page.getByText("Conta de luz").first()).toBeVisible();
    await expect(page.getByText("IPVA").first()).toBeVisible();
    // Fatura do cartão aparece no calendário
    await expect(page.getByText(/Fatura Cartão Nubank: R\$\s850,50 vence 20\//)).toBeVisible();
    await expect(page.getByText("Dia 20: Fatura Cartão Nubank")).toBeAttached();
    await page.getByRole("button", { name: "Marcar como paga" }).first().click();
    await expect.poll(() => writes!.filter((w) => w.table === "bill_payments").length).toBeGreaterThan(0);
    expect(writes!.find((w) => w.table === "bill_payments")?.body).toEqual(expect.objectContaining({ user_id: USER_ID }));
  });
});

test.describe("Cartões", () => {
  test("mostra fatura, vencimento e uso do limite", async ({ page, context }) => {
    await mockSupabase(context);
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Cartões" })).toBeVisible();
    await expect(page.getByText("Cartão Nubank").first()).toBeVisible();
    await expect(page.getByText("R$ 850,50").first()).toBeVisible();
    await expect(page.getByText("R$ 127,58").first()).toBeVisible();
  });
});

test.describe("Imposto de Renda", () => {
  test("monta o resumo do ano", async ({ page, context }) => {
    await mockSupabase(context);
    await page.goto("/taxes");
    await expect(page.getByRole("heading", { name: "Imposto de Renda" })).toBeVisible();
    await expect(page.getByText("PETR4").first()).toBeVisible();
  });
});

test.describe("Família", () => {
  test("administrador vê o estado de cada pessoa e gera convite", async ({ page, context }) => {
    const writes: MockOptions["writes"] = [];
    await mockSupabase(context, { writes });
    await page.goto("/family");
    await expect(page.getByText("Painel de Família Demo")).toBeVisible();
    await expect(page.getByText("Precisa reconectar o banco", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Gerar link de convite" }).click();
    await expect(page.getByLabel("Link de convite")).toHaveValue(new RegExp(`/convite/${"a".repeat(64)}$`));
    expect(writes!.map((w) => w.table)).toContain("rpc:create_family_invite");
  });

  test("convite aberto sem login guarda o link e leva ao cadastro", async ({ page }) => {
    await page.goto(`/convite/${"b".repeat(64)}`);
    await expect(page).toHaveURL(/\/auth\?convite=1/);
    // Fica salvo no navegador (não só na aba): o e-mail de confirmação abre o app em outra aba
    const saved = await page.evaluate(() => localStorage.getItem("nexos:pending-invite"));
    expect(JSON.parse(saved ?? "{}").token).toBe("b".repeat(64));
  });
});

test.describe("Avisos e conta", () => {
  test("sino mostra avisos não lidos", async ({ page, context }) => {
    await mockSupabase(context);
    await page.goto("/");
    const bell = page.getByRole("button", { name: "Avisos: 1 não lidos" });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByText("Conta de luz vence em 2 dias")).toBeVisible();
  });

  test("excluir conta exige digitar EXCLUIR", async ({ page, context }) => {
    const calls: string[] = [];
    await mockSupabase(context, { functions: (name) => { calls.push(name); return { deleted: true }; } });
    await page.goto("/account");
    await page.getByRole("button", { name: "Excluir conta" }).click();
    const confirm = page.getByRole("button", { name: "Excluir para sempre" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Digite EXCLUIR para confirmar").fill("excluir");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect.poll(() => calls).toContain("delete-account");
  });

  test("manifesto do app instalável está disponível", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});

test.describe("Celular: nada passa da largura da tela", () => {
  const ROUTES = ["/", "/expenses", "/budgets", "/open-finance", "/investments", "/simulation", "/reports", "/categorization", "/rules", "/bills", "/cards", "/taxes", "/family", "/account", "/privacy"];
  for (const path of ROUTES) {
    test(`sem rolagem lateral em ${path}`, async ({ page, context }, info) => {
      test.skip(!isMobile(info.project.name), "só no celular");
      await mockSupabase(context);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      const offenders = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const clipped = (el: Element) => {
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { // o body corta por segurança; o teste quer o conteúdo cabendo de verdade
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return p.getBoundingClientRect().right <= vw + 1;
          }
          return false;
        };
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(el).position === "fixed") continue;
          if (r.right > vw + 1 && !clipped(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} → ${Math.round(r.right)}px`);
        }
        return { vw, scroll: document.documentElement.scrollWidth, out: out.slice(0, 6) };
      });
      expect(offenders.out, `largura ${offenders.vw}px, página ${offenders.scroll}px`).toEqual([]);
      expect(offenders.scroll).toBeLessThanOrEqual(offenders.vw);
    });
  }
});

test.describe("Excluir com desfazer", () => {
  test("apagar duas transações seguidas apaga as duas; desfazer devolve a certa", async ({ page, context }, info) => {
    test.skip(isMobile(info.project.name), "fluxo testado no desktop");
    const tables = fixtures();
    const today = new Date().toISOString().slice(0, 10);
    tables.transactions = ["Padaria", "Farmácia", "Cinema"].map((description, i) => ({
      id: `00000000-0000-4000-8000-0000000000${70 + i}`, user_id: USER_ID, type: "expense", category: "Outros",
      description, amount: 10 + i, date: today, created_at: "", updated_at: "",
    }));
    const writes: MockOptions["writes"] = [];
    await mockSupabase(context, { tables, writes });
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Excluir Padaria" }).click();
    await page.getByRole("button", { name: "Excluir Farmácia" }).click();
    await page.getByRole("button", { name: "Excluir Cinema" }).click();
    // Desfaz só a Farmácia (antes, o "Desfazer" restaurava o último item apagado)
    // Os avisos ficam empilhados e animando: clica no "Desfazer" do aviso da Farmácia
    await page.locator("[data-sonner-toast]").filter({ hasText: "Farmácia" }).getByRole("button", { name: "Desfazer" }).dispatchEvent("click");
    await expect(page.getByRole("button", { name: "Excluir Farmácia" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Excluir Padaria" })).toHaveCount(0);
    await expect.poll(() => writes!.filter((w) => w.table === "transactions" && w.method === "DELETE").map((w) => w.query), { timeout: 10_000 })
      .toEqual(expect.arrayContaining([expect.stringContaining("0070"), expect.stringContaining("0072")]));
    await page.waitForTimeout(500);
    const deleted = writes!.filter((w) => w.table === "transactions" && w.method === "DELETE").map((w) => w.query ?? "");
    expect(deleted.some((q) => q.includes("0071"))).toBe(false);
    expect(deleted).toHaveLength(2);
  });
});

test.describe("Lista de transações", () => {
  test("mostra 10 por vez com Ver mais no fim", async ({ page, context }) => {
    const tables = fixtures();
    const today = new Date().toISOString().slice(0, 10);
    tables.synced_transactions = [];
    tables.transactions = Array.from({ length: 25 }, (_, i) => ({
      id: `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`, user_id: USER_ID, type: "expense", category: "Outros",
      description: `Compra ${i + 1}`, amount: 10 + i, date: today, created_at: "", updated_at: "",
    }));
    await mockSupabase(context, { tables });
    await page.goto("/expenses");
    const deleteButtons = page.getByRole("button", { name: /^Excluir Compra/ });
    await expect(deleteButtons).toHaveCount(10);
    await page.getByRole("button", { name: /Ver mais 10/ }).click();
    await expect(deleteButtons).toHaveCount(20);
    await page.getByRole("button", { name: /Ver mais 5/ }).click();
    await expect(deleteButtons).toHaveCount(25);
    await expect(page.getByRole("button", { name: /Ver mais/ })).toHaveCount(0);
  });
});

test.describe("Conexões do banco", () => {
  test("contas com nomes legíveis, saldo x fatura e data dos dados do banco", async ({ page, context }) => {
    await mockSupabase(context);
    await page.goto("/open-finance");
    await expect(page.getByText("Dados do banco de 02/10 21:36")).toBeVisible();
    await expect(page.getByText("Conta corrente").first()).toBeVisible();
    await expect(page.getByText("Nu Pagamentos S.A.", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Cartão Nubank").first()).toBeVisible();
    await expect(page.getByText(/Limite usado R\$\s850,50 de R\$\s5\.000,00/)).toBeVisible();
  });
});

test.describe("Investimentos no banco", () => {
  test("separa investimentos e conta e estima o rendimento pela variação do saldo", async ({ page, context }) => {
    const tables = fixtures();
    // Banco sem rendimento informado (como as caixinhas do Nubank)
    tables.synced_investments = (tables.synced_investments as Array<Record<string, unknown>>).map((i) => ({ ...i, amount_profit: null, amount_original: null }));
    tables.investment_balance_history = [
      { bank_connection_id: "c1", date: "2026-09-01", balance: 3600 },
      { bank_connection_id: "c1", date: "2026-10-01", balance: 3744.8 },
    ];
    await mockSupabase(context, { tables });
    await page.goto("/open-finance");
    // 2.644,80 + 1.100 em investimentos + 3.200 na conta (o cartão não entra)
    await expect(page.getByText(/R\$\s3\.200,00 na conta =\s*R\$\s6\.944,80\s*no banco/)).toBeVisible();
    // Posição zerada (resgatada) não aparece
    await expect(page.getByText("Resgatado")).toHaveCount(0);
    await expect(page.getByText(/≈\s*R\$\s144,80/)).toBeVisible();
    await expect(page.getByText(/Desde 01\/09/)).toBeVisible();
  });
});
