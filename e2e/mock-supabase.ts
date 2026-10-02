// Supabase simulado para os testes E2E: sessão falsa no navegador e respostas fixas da API.
// Todos os dados são fictícios.
import type { BrowserContext, Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL;
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];

export const USER_ID = "00000000-0000-4000-8000-000000000001";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, exp, role: "authenticated" })}.sig`;
const user = { id: USER_ID, aud: "authenticated", role: "authenticated", email: "demo@exemplo.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 86400, expires_at: exp, user };

const now = new Date();
const ym = (n: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const day = (n: number, d: number) => `${ym(n)}-${String(Math.min(d, n === 0 ? now.getDate() : 28)).padStart(2, "0")}`;

let seq = 0;
const synced = (n: number, d: number, description: string, amount: number, type: string, category: string) => ({
  id: `00000000-0000-4000-8000-1${String(++seq).padStart(11, "0")}`, user_id: USER_ID, bank_connection_id: "c1", external_id: `e${seq}`,
  description, amount, date: day(n, d), type, original_category: null, ai_category: category, ai_confidence: 0.9, is_reviewed: false,
  synced_at: "", created_at: "", updated_at: "", bank_account_id: "a1", source: "pluggy", installment_info: null, hash: null, category_source: "ai",
});

export function fixtures(opts: { uiMode?: "simple" | "complete"; onboardingCompleted?: boolean } = {}) {
  return {
    profiles: [{ id: USER_ID, display_name: "Demo", ui_mode: opts.uiMode ?? "complete", onboarding_completed: opts.onboardingCompleted ?? true, created_at: "", updated_at: "" }],
    bank_connections: [{ id: "c1", user_id: USER_ID, institution_name: "Nubank", pluggy_item_id: "i1", status: "connected", last_sync_at: now.toISOString(), provider: "pluggy", status_detail: null, consent_expires_at: null, auto_sync: true, created_at: "", updated_at: "" }],
    bank_accounts: [
      { id: "a1", user_id: USER_ID, bank_connection_id: "c1", external_id: "x", name: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)", type: "BANK", subtype: null, number: null, balance: 3200, currency_code: "BRL", credit_limit: null, available_credit_limit: null, balance_due_date: null, balance_close_date: null, minimum_payment: null, card_brand: null, created_at: "", updated_at: "" },
      { id: "a2", user_id: USER_ID, bank_connection_id: "c1", external_id: "y", name: "Cartão Nubank", type: "CREDIT", subtype: "CREDIT_CARD", number: "1234", balance: 850.5, currency_code: "BRL", credit_limit: 5000, available_credit_limit: 4149.5, balance_due_date: `${ym(0)}-20`, balance_close_date: `${ym(0)}-13`, minimum_payment: 127.58, card_brand: "MASTERCARD", created_at: "", updated_at: "" },
    ],
    synced_transactions: [0, 1, 2].flatMap((n) => [
      synced(n, 1, "Salário Empresa Fictícia", 5200, "income", "Salário"),
      synced(n, 5, "NETFLIX.COM", 55.9, "expense", "Assinaturas"),
      synced(n, 8, "Aluguel", 1500, "expense", "Moradia"),
      synced(n, 12, "Pagamento efetuado|EMPREENDIMENTO_EDUCACIONAL_MARACANAU_LTDA_UNIDADE_CENTRO", 423.18, "expense", "Educação"),
      synced(n, 14, "DUMBBELLS ACADEMIA VILA*CONSULTA*CLINICA*ODONTOLOGICA*LTDA", 100, "expense", "Saúde"),
    ]),
    // Ano anterior, para o resumo do Imposto de Renda
    ...[1, 2].map((m) => ({ ...synced(0, 1, "Pagamento efetuado|EMPREENDIMENTO_EDUCACIONAL_MARACANAU_LTDA_UNIDADE_CENTRO", 423.18, "expense", "Educação"), date: `${now.getFullYear() - 1}-0${m}-15` })),
    ...[1, 2].map((m) => ({ ...synced(0, 1, "DUMBBELLS ACADEMIA VILA*CONSULTA*CLINICA*ODONTOLOGICA*LTDA", 100, "expense", "Saúde"), date: `${now.getFullYear() - 1}-0${m}-20` })),
    synced_investments: [
      { id: "si1", user_id: USER_ID, bank_connection_id: "c1", external_id: "inv1", name: "Banco do Brasil ON", code: "BBAS3", type: "EQUITY", subtype: null, balance: 2644.8, amount_original: null, amount_profit: null, quantity: 100, unit_value: 26.448, rate: null, rate_type: null, issuer: null, status: "ACTIVE", due_date: null, reference_date: ym(0) + "-01", currency_code: "BRL", synced_at: now.toISOString(), created_at: now.toISOString(), updated_at: "" },
      { id: "si2", user_id: USER_ID, bank_connection_id: "c1", external_id: "inv2", name: "CDB Liquidez", code: null, type: "FIXED_INCOME", subtype: "CDB", balance: 1100, amount_original: 1000, amount_profit: 100, quantity: null, unit_value: null, rate: 100, rate_type: "CDI", issuer: "Nubank", status: "ACTIVE", due_date: null, reference_date: ym(0) + "-01", currency_code: "BRL", synced_at: now.toISOString(), created_at: now.toISOString(), updated_at: "" },
      { id: "si3", user_id: USER_ID, bank_connection_id: "c1", external_id: "inv3", name: "Resgatado", code: null, type: "FIXED_INCOME", subtype: null, balance: 0, amount_original: null, amount_profit: null, quantity: null, unit_value: null, rate: null, rate_type: null, issuer: null, status: "TOTAL_WITHDRAWAL", due_date: null, reference_date: null, currency_code: "BRL", synced_at: now.toISOString(), created_at: now.toISOString(), updated_at: "" },
    ],
    transactions: [
      { id: "t1", user_id: USER_ID, type: "expense", category: "Educação", description: "Pagamento efetuado|EMPREENDIMENTO EDUC MARAC LTDA UNIDADE CENTRO FORTALEZA", amount: 423.18, date: `${now.getFullYear() - 1}-12-15`, created_at: "", updated_at: "" },
      { id: "t2", user_id: USER_ID, type: "expense", category: "Saúde", description: "DUMBBELLS*ACADEMIA*VILA*CONSULTA*CLINICA*ODONTOLOGICA*LTDA", amount: 100, date: `${now.getFullYear() - 1}-10-08`, created_at: "", updated_at: "" },
    ] as unknown[],
    investments: [{ id: "iv1", user_id: USER_ID, asset_name: "PETR4", asset_type: "Ações", quantity: 100, purchase_price: 30, current_price: 36, purchase_date: `${now.getFullYear() - 1}-03-10`, created_at: "", updated_at: "" }],
    category_budgets: [] as unknown[],
    bills: [
      { id: "b1", user_id: USER_ID, title: "Conta de luz", amount: 180, category: "Moradia", recurrence: "monthly", due_day: 10, due_date: null, active: true, created_at: "", updated_at: "" },
      { id: "b2", user_id: USER_ID, title: "IPVA", amount: 950, category: "Transporte", recurrence: "once", due_day: null, due_date: `${ym(0)}-25`, active: true, created_at: "", updated_at: "" },
    ],
    bill_payments: [] as unknown[],
    notifications: [
      { id: "n1", user_id: USER_ID, kind: "bill_due", title: "Conta de luz vence em 2 dias", body: "R$ 180,00", link: "/bills", dedupe_key: "k1", read_at: null, emailed_at: null, created_at: now.toISOString() },
    ],
    families: [{ id: "f1", name: "Família Demo", created_by: USER_ID, created_at: "" }],
    family_members: [
      { family_id: "f1", user_id: USER_ID, role: "admin", display_name: "Demo", joined_at: "" },
      { family_id: "f1", user_id: "00000000-0000-4000-8000-000000000002", role: "member", display_name: "Ana", joined_at: "" },
    ],
    family_invites: [] as unknown[],
    financial_goals: [] as unknown[],
  } as Record<string, unknown[]>;
}

/** Respostas padrão das funções do banco (RPC) */
const defaultRpc = (name: string): unknown => {
  if (name === "family_overview") {
    const base = { connections: 1, pluggy_connections: 1, problem_connections: 0, reauth_connections: 0, next_consent_expiry: null, has_own_pluggy: false, joined_at: "" };
    return [
      { ...base, user_id: USER_ID, display_name: "Demo", role: "admin", last_sync_at: now.toISOString() },
      { ...base, user_id: "00000000-0000-4000-8000-000000000002", display_name: "Ana", role: "member", reauth_connections: 1, last_sync_at: null },
    ];
  }
  if (name === "create_family_invite") return "a".repeat(64);
  return null;
};

export interface MockOptions {
  tables?: Record<string, unknown[]>;
  /** Respostas de erro por tabela: { tabela: { status, body } } */
  failTables?: Record<string, { status: number; body: object }>;
  /** Registra as escritas (POST/PATCH/DELETE) feitas pelo app */
  writes?: Array<{ table: string; method: string; body: unknown }>;
  /** Resposta das Edge Functions: (nome, corpo) => JSON */
  functions?: (name: string, body: Record<string, unknown>) => unknown;
}

export async function mockSupabase(context: BrowserContext, opts: MockOptions = {}) {
  const tables = opts.tables ?? fixtures();
  await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  await context.route(`${SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/user")) return route.fulfill({ json: user });
    if (url.pathname.startsWith("/auth/v1/")) return route.fulfill({ json: session });
    if (url.pathname.startsWith("/functions/v1/market-rates")) {
      return route.fulfill({ json: { selic: 15, cdi: 14.9, ipca: 5.1, updatedAt: "2026-09-29", source: "bcb" } });
    }
    if (url.pathname.startsWith("/functions/v1/")) {
      const name = url.pathname.replace("/functions/v1/", "");
      const body = (req.postDataJSON?.() ?? {}) as Record<string, unknown>;
      return route.fulfill({ json: opts.functions?.(name, body) ?? {} });
    }
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)/);
    if (rpc) {
      opts.writes?.push({ table: `rpc:${rpc[1]}`, method: req.method(), body: req.postDataJSON?.() ?? null });
      return route.fulfill({ json: defaultRpc(rpc[1]) });
    }
    const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)/);
    if (m) {
      const table = m[1];
      const fail = opts.failTables?.[table];
      if (fail) return route.fulfill({ status: fail.status, json: fail.body });
      if (req.method() !== "GET" && req.method() !== "HEAD") {
        opts.writes?.push({ table, method: req.method(), body: req.postDataJSON?.() ?? null });
        return route.fulfill({ status: 201, json: [] });
      }
      const rows = tables[table] ?? [];
      const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      return route.fulfill({ json: single ? rows[0] ?? null : rows });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}
