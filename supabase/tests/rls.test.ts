// Testes de segurança do banco: aplica as migrações reais num Postgres embutido (PGlite)
// e tenta, como usuário comum, acessar ou alterar dados de outra pessoa.
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { USER_TABLES_DELETE_ORDER } from "../functions/_shared/user-data";

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");
// Dependem de extensões do Supabase (pg_cron, pg_net, vault) que não existem aqui
const SKIP = [/193700_/, /193722_/];

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ITEM = "11111111-1111-4111-8111-111111111111";
const C = "00000000-0000-4000-8000-00000000000c";

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
  await db.exec(`INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}'), ('${C}');`);
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

describe("pluggy_credentials", () => {
  it("the app can never read or write stored Pluggy credentials, not even its own", async () => {
    await asService(
      `INSERT INTO public.pluggy_credentials (user_id, client_id, secret_ciphertext, secret_iv) VALUES ($1, 'cid', 'cipher', 'iv')`,
      [A],
    );
    await expect(asUser(A, `SELECT * FROM public.pluggy_credentials`)).rejects.toThrow(/permission denied/);
    await expect(
      asUser(A, `INSERT INTO public.pluggy_credentials (user_id, client_id, secret_ciphertext, secret_iv) VALUES ($1, 'x', 'y', 'z')`, [B]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(A, `DELETE FROM public.pluggy_credentials`)).rejects.toThrow(/permission denied/);
    const { rows } = await asService(`SELECT client_id FROM public.pluggy_credentials WHERE user_id = $1`, [A]);
    expect(rows).toHaveLength(1);
  });
});

describe("migrações", () => {
  // A publicação automática (db push) pode reaplicar migrações já rodadas à mão no SQL Editor
  it("as migrações a partir de 2026-10-01 podem ser aplicadas de novo sem erro", async () => {
    const recent = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f >= "20261001" && f.endsWith(".sql")).sort();
    expect(recent.length).toBeGreaterThan(0);
    for (const f of recent) {
      await expect(db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")), f).resolves.toBeDefined();
    }
  });
});

describe("contas a pagar", () => {
  it("cada pessoa só vê e marca as próprias contas", async () => {
    const { rows } = await asUser(A, `INSERT INTO public.bills (user_id, title, amount, due_day) VALUES ($1, 'Luz', 120, 10) RETURNING id`, [A]);
    const billA = (rows[0] as { id: string }).id;
    expect((await asUser(B, `SELECT * FROM public.bills`)).rows).toHaveLength(0);
    // B não consegue marcar como paga a conta de A
    await expect(
      asUser(B, `INSERT INTO public.bill_payments (user_id, bill_id, period) VALUES ($1, $2, '2026-10')`, [B, billA]),
    ).rejects.toThrow(/row-level security/);
    await asUser(A, `INSERT INTO public.bill_payments (user_id, bill_id, period) VALUES ($1, $2, '2026-10')`, [A, billA]);
    await expect(asUser(A, `INSERT INTO public.bills (user_id, title, amount) VALUES ($1, 'Sem dia', 1)`, [A])).rejects.toThrow(/bills_due_check/);
  });
});

describe("avisos", () => {
  it("só o servidor cria avisos; a pessoa lê, marca como lido e apaga os seus", async () => {
    await expect(
      asUser(A, `INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key) VALUES ($1, 'x', 't', 'b', 'k')`, [A]),
    ).rejects.toThrow(/permission denied/);
    await asService(`INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key) VALUES ($1, 'budget', 'Limite', 'Passou', 'k1')`, [A]);
    expect((await asUser(A, `SELECT * FROM public.notifications`)).rows).toHaveLength(1);
    expect((await asUser(B, `SELECT * FROM public.notifications`)).rows).toHaveLength(0);
    await asUser(A, `UPDATE public.notifications SET read_at = now()`);
    await expect(asUser(A, `UPDATE public.notifications SET title = 'falso'`)).rejects.toThrow(/permission denied/);
    // O mesmo aviso não é criado duas vezes
    await expect(
      asService(`INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key) VALUES ($1, 'budget', 'Limite', 'Passou', 'k1')`, [A]),
    ).rejects.toThrow(/duplicate key/);
  });
});

describe("família", () => {
  let token = "";

  it("o administrador cria a família e gera um convite de uso único", async () => {
    await asUser(A, `SELECT public.create_family('Família Teste', 'Murilo')`);
    const r = await asUser(A, `SELECT public.create_family_invite() AS token`);
    token = (r.rows[0] as { token: string }).token;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // O token não fica guardado no banco, só o hash
    const stored = await asService(`SELECT token_hash FROM public.family_invites`);
    expect(JSON.stringify(stored.rows)).not.toContain(token);
  });

  it("quem recebe o link vê o convite e entra na família", async () => {
    const peek = await asUser(B, `SELECT * FROM public.peek_family_invite($1)`, [token]);
    expect(peek.rows[0]).toMatchObject({ family_name: "Família Teste", admin_name: "Murilo", valid: true });
    await asUser(B, `SELECT public.accept_family_invite($1, 'Ana')`, [token]);
    const members = await asUser(B, `SELECT display_name, role FROM public.family_members ORDER BY role`);
    expect(members.rows).toEqual([{ display_name: "Murilo", role: "admin" }, { display_name: "Ana", role: "member" }]);
  });

  it("o convite não pode ser usado de novo e estranhos não veem a família", async () => {
    await expect(asUser(C, `SELECT public.accept_family_invite($1, 'Intruso')`, [token])).rejects.toThrow(/inválido, expirado ou já usado/);
    expect((await asUser(C, `SELECT * FROM public.families`)).rows).toHaveLength(0);
    expect((await asUser(C, `SELECT * FROM public.family_members`)).rows).toHaveLength(0);
    await expect(asUser(C, `SELECT * FROM public.peek_family_invite('0000')`)).resolves.toBeDefined();
  });

  it("ninguém entra na família sem convite nem vira administrador escrevendo direto na tabela", async () => {
    const { rows } = await asService(`SELECT id FROM public.families`);
    const fam = (rows[0] as { id: string }).id;
    await expect(
      asUser(C, `INSERT INTO public.family_members (family_id, user_id, role, display_name) VALUES ($1, $2, 'admin', 'x')`, [fam, C]),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(B, `UPDATE public.family_members SET role = 'admin' WHERE user_id = $1`, [B])).rejects.toThrow(/permission denied/);
  });

  it("o painel mostra só o estado das conexões, e só para o administrador", async () => {
    const overview = await asUser(A, `SELECT * FROM public.family_overview()`);
    expect(overview.rows).toHaveLength(2);
    const columns = Object.keys(overview.rows[0] as object);
    // Nada de valores, descrições ou saldos
    for (const forbidden of ["amount", "balance", "description", "transactions"]) {
      expect(columns.join(",")).not.toContain(forbidden);
    }
    await expect(asUser(B, `SELECT * FROM public.family_overview()`)).rejects.toThrow(/administrador/);
    // Membro também não lê as transações do outro por fazer parte da família
    expect((await asUser(B, `SELECT * FROM public.synced_transactions WHERE user_id = $1`, [A])).rows).toHaveLength(0);
  });

  it("membro sai da família; administrador remove membros", async () => {
    await asUser(B, `SELECT public.leave_family()`);
    expect((await asUser(A, `SELECT * FROM public.family_members`)).rows).toHaveLength(1);
    await expect(asUser(B, `SELECT public.remove_family_member($1)`, [A])).rejects.toThrow(/administrador/);
  });
});

describe("LGPD", () => {
  it("toda tabela com user_id entra na exclusão de conta", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'user_id'`,
    );
    // family_members é tratada à parte (sair da família / apagar a família do administrador)
    const handled = new Set<string>([...USER_TABLES_DELETE_ORDER, "family_members"]);
    expect(rows.map((r) => r.table_name).filter((t) => !handled.has(t)).sort()).toEqual([]);
  });
});

describe("auditoria geral de acesso", () => {
  it("toda regra de acesso em tabela com user_id depende do usuário logado", async () => {
    const { rows } = await db.query<{ tablename: string; policyname: string; qual: string | null; with_check: string | null }>(
      `SELECT p.tablename, p.policyname, p.qual, p.with_check FROM pg_policies p
       WHERE p.schemaname = 'public'
         AND EXISTS (SELECT 1 FROM information_schema.columns c
                     WHERE c.table_schema = 'public' AND c.table_name = p.tablename AND c.column_name = 'user_id')`,
    );
    expect(rows.length).toBeGreaterThan(0);
    const scoped = (expr: string | null) => expr === null || /auth\.uid\(\)|my_family_id\(\)|is_family_admin\(/.test(expr);
    const loose = rows.filter((r) => !scoped(r.qual) || !scoped(r.with_check)).map((r) => `${r.tablename}: ${r.policyname}`);
    expect(loose).toEqual([]);
  });

  it("funções privilegiadas fixam o search_path e não ficam abertas para visitantes", async () => {
    const { rows } = await db.query<{ proname: string; fixed: boolean; anon: boolean }>(
      `SELECT p.proname,
              coalesce(array_to_string(p.proconfig, ',') LIKE '%search_path=%', false) AS fixed,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.fixed).map((r) => r.proname)).toEqual([]);
    expect(rows.filter((r) => r.anon).map((r) => r.proname)).toEqual([]);
  });

  it("visitante sem login não lê nenhuma tabela com dados de usuário", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'user_id'`,
    );
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SET ROLE anon;");
    try {
      for (const { table_name } of rows) {
        const count = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table_name}`).then((r) => r.rows[0].n, () => 0);
        expect(count, table_name).toBe(0);
      }
    } finally {
      await db.exec("RESET ROLE;");
    }
  });

  it("ninguém lê, altera ou apaga linhas de outra pessoa em nenhuma tabela", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'user_id'`,
    );
    // Dados de B em várias tabelas, criados pelo servidor
    await asService(`INSERT INTO public.transactions (user_id, type, description, category, amount) VALUES ($1, 'expense', 'Mercado', 'Alimentação', 10)`, [B]);
    await asService(`INSERT INTO public.investments (user_id, asset_name, asset_type, quantity, purchase_price, current_price, purchase_date) VALUES ($1, 'PETR4', 'Ações', 1, 30, 30, '2026-01-02')`, [B]);
    await asService(`INSERT INTO public.notifications (user_id, kind, title, body, dedupe_key) VALUES ($1, 'x', 't', 'b', 'audit')`, [B]);
    await asService(`INSERT INTO public.bills (user_id, title, amount, recurrence, due_day) VALUES ($1, 'Luz', 100, 'monthly', 10)`, [B]);
    const problems: string[] = [];
    let checked = 0;
    for (const { table_name: t } of rows) {
      const theirs = await asService(`SELECT count(*)::int AS n FROM public.${t} WHERE user_id = $1`, [B]).then((r) => (r.rows[0] as { n: number }).n);
      if (theirs === 0) continue;
      checked++;
      const seen = await asUser(A, `SELECT count(*)::int AS n FROM public.${t} WHERE user_id = $1`, [B]).then((r) => (r.rows[0] as { n: number }).n, () => 0);
      if (seen > 0 && t !== "family_members") problems.push(`${t}: lê`);
      const changed = await asUser(A, `UPDATE public.${t} SET user_id = user_id WHERE user_id = $1`, [B]).then((r) => r.affectedRows ?? 0, () => 0);
      if (changed > 0) problems.push(`${t}: altera`);
      const deleted = await asUser(A, `DELETE FROM public.${t} WHERE user_id = $1`, [B]).then((r) => r.affectedRows ?? 0, () => 0);
      if (deleted > 0) problems.push(`${t}: apaga`);
    }
    expect(checked).toBeGreaterThanOrEqual(5);
    expect(problems).toEqual([]);
  });
});

describe("investimentos", () => {
  it("guardam quantidades grandes e preços de frações de centavo (cripto)", async () => {
    const { rows } = await asUser(
      A,
      `INSERT INTO public.investments (user_id, asset_name, asset_type, quantity, purchase_price, current_price, purchase_date)
       VALUES ($1, 'SHIB', 'Criptomoedas', 25000000, 0.00008123, 0.00009456, '2026-01-02')
       RETURNING quantity::text AS q, purchase_price::text AS p, current_price::text AS c`,
      [A],
    );
    const r = rows[0] as { q: string; p: string; c: string };
    expect(Number(r.q)).toBe(25_000_000);
    expect(Number(r.p)).toBeCloseTo(0.00008123, 10);
    expect(Number(r.c)).toBeCloseTo(0.00009456, 10);
  });
});


describe("importar transações do banco", () => {
  it("marca e insere juntas, uma vez só, e nunca pega transação de outra pessoa", async () => {
    const { rows: conns } = await asUser(A, `SELECT id FROM public.bank_connections WHERE user_id = $1 LIMIT 1`, [A]);
    const connA = (conns[0] as { id: string }).id;
    const { rows } = await asUser(
      A,
      `INSERT INTO public.synced_transactions (user_id, bank_connection_id, external_id, description, amount, date, type, installment_info, source)
       VALUES ($1, $2, 'imp1', 'Loja', 30, '2026-10-01', 'expense', '2/3', 'csv_card') RETURNING id`,
      [A, connA],
    );
    const id = (rows[0] as { id: string }).id;
    const items = JSON.stringify([{ id, category: "Compras" }]);

    // Outra pessoa não importa (nem marca) a transação de A
    const other = await asUser(B, `SELECT public.import_synced_transactions($1::jsonb) AS n`, [items]);
    expect((other.rows[0] as { n: number }).n).toBe(0);

    const first = await asUser(A, `SELECT public.import_synced_transactions($1::jsonb) AS n`, [items]);
    expect((first.rows[0] as { n: number }).n).toBe(1);
    const again = await asUser(A, `SELECT public.import_synced_transactions($1::jsonb) AS n`, [items]);
    expect((again.rows[0] as { n: number }).n).toBe(0);

    const imported = await asUser(A, `SELECT description, category, amount::float AS amount FROM public.transactions WHERE description LIKE 'Loja%'`);
    expect(imported.rows).toEqual([{ description: "Loja (2/3)", category: "Compras", amount: 30 }]);
  });

  it("visitante sem login não chama a função", async () => {
    const { rows } = await db.query<{ ok: boolean }>(`SELECT has_function_privilege('anon', 'public.import_synced_transactions(jsonb)', 'EXECUTE') AS ok`);
    expect(rows[0].ok).toBe(false);
  });
});

describe("lançamentos manuais", () => {
  it("valor precisa ser maior que zero", async () => {
    await expect(
      asUser(A, `INSERT INTO public.transactions (user_id, type, description, category, amount) VALUES ($1, 'expense', 'x', 'Outros', -5)`, [A]),
    ).rejects.toThrow(/transactions_amount_positive/);
    await expect(
      asUser(A, `INSERT INTO public.transactions (user_id, type, description, category, amount) VALUES ($1, 'expense', 'x', 'Outros', 0)`, [A]),
    ).rejects.toThrow(/transactions_amount_positive/);
  });
});

describe("correção do Pix", () => {
  it("limpa a categoria 'Transferência' dada pela regra antiga e apaga regras aprendidas genéricas", async () => {
    const { rows: conns } = await asUser(A, `SELECT id FROM public.bank_connections WHERE user_id = $1 LIMIT 1`, [A]);
    const connA = (conns[0] as { id: string }).id;
    await asUser(
      A,
      `INSERT INTO public.synced_transactions (user_id, bank_connection_id, external_id, description, amount, date, ai_category, category_source, source) VALUES
       ($1, $2, 'p1', 'Transferência enviada pelo Pix - IMOBILIARIA', 1500, '2026-09-05', 'Transferência', 'rule', 'csv_account'),
       ($1, $2, 'p2', 'Pagamento de fatura', 900, '2026-09-06', 'Transferência', 'rule', 'csv_account'),
       ($1, $2, 'p3', 'Pix enviado - MURILO', 100, '2026-09-07', 'Transferência', 'user', 'csv_account')`,
      [A, connA],
    );
    await asUser(A, `INSERT INTO public.categorization_rules (user_id, keyword, category) VALUES ($1, 'transferencia enviada pelo', 'Transferência'), ($1, 'imobiliaria', 'Moradia')`, [A]);

    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, "20261004100000_financial_fixes.sql"), "utf8"));

    const { rows } = await asService(`SELECT external_id, ai_category FROM public.synced_transactions WHERE external_id IN ('p1','p2','p3') ORDER BY external_id`);
    expect(rows).toEqual([
      { external_id: "p1", ai_category: null },
      { external_id: "p2", ai_category: "Transferência" },
      { external_id: "p3", ai_category: "Transferência" },
    ]);
    const rules = await asUser(A, `SELECT keyword FROM public.categorization_rules ORDER BY keyword`);
    expect(rules.rows).toEqual([{ keyword: "imobiliaria" }]);
  });
});
