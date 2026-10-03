-- Quando o banco (via Pluggy) atualizou os dados pela última vez. Diferente de last_sync_at,
-- que é quando o Nexos leu da Pluggy: mostra se o saldo/fatura na tela é de agora ou de ontem.
ALTER TABLE public.bank_connections ADD COLUMN IF NOT EXISTS bank_updated_at TIMESTAMP WITH TIME ZONE;

-- Histórico diário do saldo dos investimentos de cada conexão. Serve para estimar o rendimento
-- quando o banco não informa (caixinhas do Nubank): variação do saldo menos aportes e resgates.
CREATE TABLE IF NOT EXISTS public.investment_balance_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  balance NUMERIC(24, 8) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (bank_connection_id, date)
);

ALTER TABLE public.investment_balance_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_balance_history TO authenticated;
GRANT ALL ON public.investment_balance_history TO service_role;

DROP POLICY IF EXISTS "Users read their own balance history" ON public.investment_balance_history;
CREATE POLICY "Users read their own balance history" ON public.investment_balance_history
  FOR SELECT USING (auth.uid() = user_id);
-- Gravado pela sincronização (cliente do usuário): só em conexões da própria pessoa
DROP POLICY IF EXISTS "Users write their own balance history" ON public.investment_balance_history;
CREATE POLICY "Users write their own balance history" ON public.investment_balance_history
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users update their own balance history" ON public.investment_balance_history;
CREATE POLICY "Users update their own balance history" ON public.investment_balance_history
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users delete their own balance history" ON public.investment_balance_history;
CREATE POLICY "Users delete their own balance history" ON public.investment_balance_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_investment_balance_history_user ON public.investment_balance_history (user_id, date);