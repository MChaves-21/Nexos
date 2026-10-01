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
    bank_accounts: [{ id: "a1", user_id: USER_ID, bank_connection_id: "c1", external_id: "x", name: "Conta Nubank", type: "BANK", subtype: null, number: null, balance: 3200, currency_code: "BRL", credit_limit: null, available_credit_limit: null, created_at: "", updated_at: "" }],
    synced_transactions: [0, 1, 2].flatMap((n) => [
      synced(n, 1, "Salário Empresa Fictícia", 5200, "income", "Salário"),
      synced(n, 5, "NETFLIX.COM", 55.9, "expense", "Assinaturas"),
      synced(n, 8, "Aluguel", 1500, "expense", "Moradia"),
    ]),
    synced_investments: [
      { id: "si1", user_id: USER_ID, bank_connection_id: "c1", external_id: "inv1", name: "Banco do Brasil ON", code: "BBAS3", type: "EQUITY", subtype: null, balance: 2644.8, amount_original: null, amount_profit: null, quantity: 100, unit_value: 26.448, rate: null, rate_type: null, issuer: null, status: "ACTIVE", due_date: null, reference_date: ym(0) + "-01", currency_code: "BRL", synced_at: now.toISOString(), created_at: now.toISOString(), updated_at: "" },
      { id: "si2", user_id: USER_ID, bank_connection_id: "c1", external_id: "inv2", name: "CDB Liquidez", code: null, type: "FIXED_INCOME", subtype: "CDB", balance: 1100, amount_original: 1000, amount_profit: 100, quantity: null, unit_value: null, rate: 100, rate_type: "CDI", issuer: "Nubank", status: "ACTIVE", due_date: null, reference_date: ym(0) + "-01", currency_code: "BRL", synced_at: now.toISOString(), created_at: now.toISOString(), updated_at: "" },
      { id: "si3", user_id: USER_ID, bank_connection_id: "c1", external_id: "inv3", name: "Resgatado", code: null, type: "FIXED_INCOME", subtype: null, balance: 0, amount_original: null, amount_profit: null, quantity: null, unit_value: null, rate: null, rate_type: null, issuer: null, status: "TOTAL_WITHDRAWAL", due_date: null, reference_date: null, currency_code: "BRL", synced_at: now.toISOString(), created_at: now.toISOString(), updated_at: "" },
    ],
    transactions: [] as unknown[],
    investments: [{ id: "iv1", user_id: USER_ID, asset_name: "PETR4", asset_type: "Ações", quantity: 100, purchase_price: 30, current_price: 36, purchase_date: `${now.getFullYear() - 1}-03-10`, created_at: "", updated_at: "" }],
    category_budgets: [] as unknown[],
    financial_goals: [] as unknown[],
  } as Record<string, unknown[]>;
}

export interface MockOptions {
  tables?: Record<string, unknown[]>;
  /** Respostas de erro por tabela: { tabela: { status, body } } */
  failTables?: Record<string, { status: number; body: object }>;
  /** Registra as escritas (POST/PATCH/DELETE) feitas pelo app */
  writes?: Array<{ table: string; method: string; body: unknown }>;
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
    if (url.pathname.startsWith("/functions/v1/")) return route.fulfill({ json: {} });
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
