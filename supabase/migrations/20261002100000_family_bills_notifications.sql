-- Família (convites e painel do administrador), avisos, contas a pagar e dados da fatura do cartão.
-- Idempotente: pode ser aplicada de novo sem erro.

-- =====================================================================
-- 1) Cartões: dados da fatura vindos da Pluggy
-- =====================================================================
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS balance_due_date DATE;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS balance_close_date DATE;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS minimum_payment NUMERIC;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS card_brand TEXT;

-- =====================================================================
-- 2) Preferências de aviso
-- =====================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_summary BOOLEAN NOT NULL DEFAULT true;

-- =====================================================================
-- 3) Contas a pagar
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  category TEXT,
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'once')),
  due_day SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  due_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT bills_due_check CHECK (
    (recurrence = 'monthly' AND due_day IS NOT NULL) OR (recurrence = 'once' AND due_date IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
  amount NUMERIC,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bill_id, period)
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills, public.bill_payments TO authenticated;
GRANT ALL ON public.bills, public.bill_payments TO service_role;

DROP POLICY IF EXISTS "Users manage their own bills" ON public.bills;
CREATE POLICY "Users manage their own bills" ON public.bills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own bill payments" ON public.bill_payments;
CREATE POLICY "Users manage their own bill payments" ON public.bill_payments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id AND b.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_bills_updated_at ON public.bills;
CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 4) Avisos (criados pelo servidor; o app só lê, marca como lido e apaga)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  -- Mesmo aviso não é criado duas vezes (ex.: "budget:Alimentação:2026-10")
  dedupe_key TEXT NOT NULL,
  emailed_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "Users read their own notifications" ON public.notifications;
CREATE POLICY "Users read their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users mark their own notifications" ON public.notifications;
CREATE POLICY "Users mark their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete their own notifications" ON public.notifications;
CREATE POLICY "Users delete their own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- =====================================================================
-- 5) Família
--    O administrador vê só o ESTADO das conexões de cada membro (via family_overview),
--    nunca transações, saldos ou investimentos.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.family_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  -- Guardamos só o hash do token; o link completo aparece uma única vez para o administrador
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
-- Leitura pelo app; toda escrita passa pelas funções abaixo
REVOKE ALL ON public.families, public.family_members, public.family_invites FROM anon, authenticated;
GRANT SELECT ON public.families, public.family_members, public.family_invites TO authenticated;
GRANT ALL ON public.families, public.family_members, public.family_invites TO service_role;

-- Funções auxiliares (security definer evita recursão nas políticas)
CREATE OR REPLACE FUNCTION public.my_family_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_family_admin(p_family UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = p_family AND user_id = auth.uid() AND role = 'admin')
$$;

DROP POLICY IF EXISTS "Members see their family" ON public.families;
CREATE POLICY "Members see their family" ON public.families
  FOR SELECT USING (id = public.my_family_id());
DROP POLICY IF EXISTS "Members see their family members" ON public.family_members;
CREATE POLICY "Members see their family members" ON public.family_members
  FOR SELECT USING (family_id = public.my_family_id());
DROP POLICY IF EXISTS "Admins see their family invites" ON public.family_invites;
CREATE POLICY "Admins see their family invites" ON public.family_invites
  FOR SELECT USING (public.is_family_admin(family_id));

CREATE OR REPLACE FUNCTION public.create_family(p_name TEXT, p_display_name TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_family UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Você já faz parte de uma família' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.families (name, created_by) VALUES (btrim(p_name), v_uid) RETURNING id INTO v_family;
  INSERT INTO public.family_members (family_id, user_id, role, display_name)
    VALUES (v_family, v_uid, 'admin', btrim(p_display_name));
  RETURN v_family;
END $$;

-- Gera um convite de uso único, válido por 7 dias. Devolve o token (só nesta chamada).
CREATE OR REPLACE FUNCTION public.create_family_invite() RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family UUID := public.my_family_id();
  v_token TEXT;
BEGIN
  IF v_family IS NULL OR NOT public.is_family_admin(v_family) THEN
    RAISE EXCEPTION 'Só o administrador da família pode convidar' USING ERRCODE = '42501';
  END IF;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.family_invites (family_id, token_hash, created_by, expires_at)
    VALUES (v_family, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), auth.uid(), now() + interval '7 days');
  RETURN v_token;
END $$;

-- Mostra para quem recebeu o link qual família está convidando (sem aceitar ainda)
CREATE OR REPLACE FUNCTION public.peek_family_invite(p_token TEXT)
RETURNS TABLE (family_name TEXT, admin_name TEXT, valid BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.name,
         (SELECT m.display_name FROM public.family_members m WHERE m.family_id = f.id AND m.role = 'admin' LIMIT 1),
         (i.used_at IS NULL AND i.expires_at > now())
  FROM public.family_invites i JOIN public.families f ON f.id = i.family_id
  WHERE i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.accept_family_invite(p_token TEXT, p_display_name TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invite public.family_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_invite FROM public.family_invites
    WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') FOR UPDATE;
  IF NOT FOUND OR v_invite.used_at IS NOT NULL OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'Convite inválido, expirado ou já usado' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'Você já faz parte de uma família' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.family_members (family_id, user_id, role, display_name)
    VALUES (v_invite.family_id, v_uid, 'member', btrim(p_display_name));
  UPDATE public.family_invites SET used_by = v_uid, used_at = now() WHERE id = v_invite.id;
  RETURN v_invite.family_id;
END $$;

-- Painel do administrador: só o estado das conexões de cada membro, sem dados financeiros
CREATE OR REPLACE FUNCTION public.family_overview()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  connections INTEGER,
  pluggy_connections INTEGER,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  problem_connections INTEGER,
  reauth_connections INTEGER,
  next_consent_expiry TIMESTAMP WITH TIME ZONE,
  has_own_pluggy BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family UUID := public.my_family_id();
BEGIN
  IF v_family IS NULL OR NOT public.is_family_admin(v_family) THEN
    RAISE EXCEPTION 'Só o administrador da família vê o painel' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.user_id, m.display_name, m.role, m.joined_at,
         count(c.id)::int,
         count(c.id) FILTER (WHERE c.provider = 'pluggy')::int,
         max(c.last_sync_at),
         count(c.id) FILTER (WHERE c.status IN ('error', 'outdated'))::int,
         count(c.id) FILTER (WHERE c.status = 'reauth_required')::int,
         min(c.consent_expires_at) FILTER (WHERE c.consent_expires_at > now()),
         EXISTS (SELECT 1 FROM public.pluggy_credentials pc WHERE pc.user_id = m.user_id)
  FROM public.family_members m
  LEFT JOIN public.bank_connections c ON c.user_id = m.user_id
  WHERE m.family_id = v_family
  GROUP BY m.user_id, m.display_name, m.role, m.joined_at
  ORDER BY m.role, m.display_name;
END $$;

CREATE OR REPLACE FUNCTION public.remove_family_member(p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family UUID := public.my_family_id();
BEGIN
  IF v_family IS NULL OR NOT public.is_family_admin(v_family) THEN
    RAISE EXCEPTION 'Só o administrador pode remover membros' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Para sair, exclua a família' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.family_members WHERE family_id = v_family AND user_id = p_user;
END $$;

CREATE OR REPLACE FUNCTION public.leave_family() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family UUID := public.my_family_id();
BEGIN
  IF v_family IS NULL THEN RETURN; END IF;
  IF public.is_family_admin(v_family) THEN
    -- Administrador saindo: a família deixa de existir (membros continuam com suas contas e dados)
    DELETE FROM public.families WHERE id = v_family;
  ELSE
    DELETE FROM public.family_members WHERE family_id = v_family AND user_id = auth.uid();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_family_invite(p_invite UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.family_invites i
  WHERE i.id = p_invite AND i.used_at IS NULL AND public.is_family_admin(i.family_id);
END $$;

REVOKE ALL ON FUNCTION public.my_family_id(), public.is_family_admin(UUID), public.create_family(TEXT, TEXT),
  public.create_family_invite(), public.peek_family_invite(TEXT), public.accept_family_invite(TEXT, TEXT),
  public.family_overview(), public.remove_family_member(UUID), public.leave_family(), public.revoke_family_invite(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_family_id(), public.is_family_admin(UUID), public.create_family(TEXT, TEXT),
  public.create_family_invite(), public.peek_family_invite(TEXT), public.accept_family_invite(TEXT, TEXT),
  public.family_overview(), public.remove_family_member(UUID), public.leave_family(), public.revoke_family_invite(UUID)
  TO authenticated;
