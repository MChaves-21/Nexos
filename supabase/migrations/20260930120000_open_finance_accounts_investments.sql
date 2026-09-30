-- Open Finance v2: contas, investimentos, importação de arquivos e regras de categorização

-- 1. bank_connections passa a representar tanto conexões Pluggy quanto "contas de arquivo" (CSV/OFX)
ALTER TABLE public.bank_connections
  ALTER COLUMN pluggy_item_id DROP NOT NULL,
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'pluggy',
  ADD COLUMN status_detail TEXT,
  ADD COLUMN consent_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN auto_sync BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.bank_connections
  ADD CONSTRAINT bank_connections_provider_check CHECK (provider IN ('pluggy', 'file')),
  ADD CONSTRAINT bank_connections_pluggy_item_check CHECK (provider <> 'pluggy' OR pluggy_item_id IS NOT NULL);

CREATE INDEX idx_bank_connections_user_item ON public.bank_connections (user_id, pluggy_item_id);

-- 2. Contas de cada conexão (conta corrente, cartão de crédito...)
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  number TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'BRL',
  credit_limit NUMERIC,
  available_credit_limit NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bank_connection_id, external_id)
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bank accounts"
  ON public.bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own bank accounts"
  ON public.bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bank accounts"
  ON public.bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bank accounts"
  ON public.bank_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Novos campos em synced_transactions
ALTER TABLE public.synced_transactions
  ADD COLUMN bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'pluggy',
  ADD COLUMN installment_info TEXT,
  ADD COLUMN hash TEXT,
  ADD COLUMN category_source TEXT;

ALTER TABLE public.synced_transactions
  ADD CONSTRAINT synced_transactions_source_check CHECK (source IN ('pluggy', 'csv_card', 'csv_account', 'ofx')),
  ADD CONSTRAINT synced_transactions_category_source_check CHECK (category_source IS NULL OR category_source IN ('rule', 'ai', 'user'));

CREATE INDEX idx_synced_transactions_user_date ON public.synced_transactions (user_id, date DESC);

-- Escolher categoria não significa ter importado. Até aqui is_reviewed era marcado
-- ao escolher categoria; mantemos os dados, mas a partir de agora só a importação marca.

-- 4. Investimentos sincronizados via Pluggy
CREATE TABLE public.synced_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  amount_original NUMERIC,
  amount_profit NUMERIC,
  quantity NUMERIC,
  unit_value NUMERIC,
  rate NUMERIC,
  rate_type TEXT,
  issuer TEXT,
  status TEXT,
  due_date DATE,
  reference_date DATE,
  currency_code TEXT NOT NULL DEFAULT 'BRL',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bank_connection_id, external_id)
);

ALTER TABLE public.synced_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own synced investments"
  ON public.synced_investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own synced investments"
  ON public.synced_investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own synced investments"
  ON public.synced_investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own synced investments"
  ON public.synced_investments FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_synced_investments_updated_at
  BEFORE UPDATE ON public.synced_investments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Regras de categorização aprendidas com as correções do usuário
CREATE TABLE public.categorization_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, keyword)
);

ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categorization rules"
  ON public.categorization_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own categorization rules"
  ON public.categorization_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categorization rules"
  ON public.categorization_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categorization rules"
  ON public.categorization_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_categorization_rules_updated_at
  BEFORE UPDATE ON public.categorization_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
