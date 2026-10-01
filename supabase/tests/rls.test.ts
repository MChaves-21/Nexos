// Testes de segurança do banco: aplica as migrações reais num Postgres embutido (PGlite)
// e tenta, como usuário comum, acessar ou alterar dados de outra pessoa.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");
// Dependem de extensões do Supabase (pg_cron, pg_net, vault) que não existem aqui
const SKIP = [/193700_/, /193722_/];

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ITEM = "11111111-1111-4111-8111-111111111111";

let db: PGlite;

// Ambiente mínimo parecido com o Supabase: papéis, auth.uid() e privilégios padrão
const BOOTSTRAP = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
CREATE PUBLICATION supabase_realtime;
`;

/** Executa SQL como um usuário autenticado (RLS ligado). */
async function asUser(userId: string, sql: string, params: unknown[] = []) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${userId}', false); SET ROLE authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("RESET ROLE;");
  }
}

async function asService(sql: string, params: unknown[] = []) {
  await db.exec("RESET ROLE; SET ROLE service_role;");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("RESET ROLE;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (SKIP.some((re) => re.test(f))) continue;
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    } catch (e) {
      throw new Error(`Migração ${f} falhou: ${(e as Error).message}`);
    }
  }
  // Usuários de teste (o trigger cria os perfis) e a conexão Pluggy de B, criada pelo servidor
  await db.exec(`INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}');`);
  await asService(
    `INSERT INTO public.bank_connections (user_id, institution_name, pluggy_item_id, provider) VALUES ($1, 'Banco B', $2, 'pluggy')`,
    [B, ITEM],
  );
}, 60_000);

describe("bank_connections", () => {
  it("users cannot create Pluggy connections directly (only the server can)", async () => {
    await expect(
      asUser(A, `INSERT INTO public.bank_connections (user_id, institution_name, pluggy_item_id, provider) VALUES ($1, 'Roubo', $2, 'pluggy')`, [A, ITEM]),
    ).rejects.toThrow(/row-level security/);
  });

  it("users can create file connections for themselves only", async () => {
    await asUser(A, `INSERT INTO public.bank_connections (user_id, institution_name, provider) VALUES ($1, 'Nubank - Cartão', 'file')`, [A]);
    await expect(
      asUser(A, `INSERT INTO public.bank_connections (user_id, institution_name, provider) VALUES ($1, 'Falso', 'file')`, [B]),
    ).rejects.toThrow(/row-level security/);
  });

  it("users cannot point their connection to another item or change its owner", async () => {
    await expect(
      asUser(A, `UPDATE public.bank_connections SET pluggy_item_id = $1 WHERE user_id = $2`, [ITEM, A]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(A, `UPDATE public.bank_connections SET user_id = $1`, [B])).rejects.toThrow(/permission denied/);
    // Campos de exibição continuam editáveis
    const r = await asUser(A, `UPDATE public.bank_connections SET auto_sync = false, institution_name = 'Cartão' WHERE user_id = $1 RETURNING id`, [A]);
    expect(r.rows).toHaveLength(1);
  });

  it("users never see or delete another person's connections", async () => {
    const seen = await asUser(A, `SELECT * FROM public.bank_connections WHERE user_id = $1`, [B]);
    expect(seen.rows).toHaveLength(0);
    const deleted = await asUser(A, `DELETE FROM public.bank_connections WHERE user_id = $1 RETURNING id`, [B]);
    expect(deleted.rows).toHaveLength(0);
  });

  it("the same Pluggy item cannot be linked to two accounts", async () => {
    await expect(
      asService(`INSERT INTO public.bank_connections (user_id, institution_name, pluggy_item_id, provider) VALUES ($1, 'Dup', $2, 'pluggy')`, [A, ITEM]),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("synced data", () => {
  it("users cannot write rows into another person's connection", async () => {
    const { rows } = await asService(`SELECT id FROM public.bank_connections WHERE user_id = $1`, [B]);
    const connB = (rows[0] as { id: string }).id;
    await expect(
      asUser(A, `INSERT INTO public.synced_transactions (user_id, bank_connection_id, external_id, description, amount, date) VALUES ($1, $2, 'x', 'bloqueio', 1, '2026-10-01')`, [A, connB]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(A, `INSERT INTO public.synced_investments (user_id, bank_connection_id, external_id, name, type) VALUES ($1, $2, 'x', 'y', 'EQUITY')`, [A, connB]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(A, `INSERT INTO public.bank_accounts (user_id, bank_connection_id, external_id, name, type) VALUES ($1, $2, 'x', 'y', 'BANK')`, [A, connB]),
    ).rejects.toThrow(/row-level security/);
  });

  it("users can write into their own file connection and only read their own rows", async () => {
    const { rows } = await asUser(A, `SELECT id FROM public.bank_connections WHERE user_id = $1`, [A]);
    const connA = (rows[0] as { id: string }).id;
    await asUser(A, `INSERT INTO public.synced_transactions (user_id, bank_connection_id, external_id, description, amount, date, source) VALUES ($1, $2, 'h1', 'Mercado', 10, '2026-10-01', 'csv_card')`, [A, connA]);
    const mine = await asUser(A, `SELECT * FROM public.synced_transactions`);
    expect(mine.rows).toHaveLength(1);
    const theirs = await asUser(B, `SELECT * FROM public.synced_transactions`);
    expect(theirs.rows).toHaveLength(0);
  });

  it("all user tables have row-level security enabled", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
});

describe("profiles", () => {
  it("new users start in simple mode with onboarding pending", async () => {
    const { rows } = await asUser(A, `SELECT ui_mode, onboarding_completed FROM public.profiles WHERE id = $1`, [A]);
    expect(rows[0]).toEqual({ ui_mode: "simple", onboarding_completed: false });
  });

  it("rejects invalid modes and edits to someone else's profile", async () => {
    await expect(asUser(A, `UPDATE public.profiles SET ui_mode = 'admin' WHERE id = $1`, [A])).rejects.toThrow(/check constraint/);
    const r = await asUser(A, `UPDATE public.profiles SET ui_mode = 'complete' WHERE id = $1 RETURNING id`, [B]);
    expect(r.rows).toHaveLength(0);
  });
});
