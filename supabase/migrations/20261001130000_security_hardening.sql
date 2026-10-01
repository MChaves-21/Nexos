-- Endurecimento de segurança do Open Finance.
--
-- 1) Conexões com a Pluggy só podem ser criadas pelo servidor (Edge Function pluggy-connect),
--    que confere se o item pertence ao usuário. Antes, o próprio app podia inserir uma conexão
--    com o Item ID de outra pessoa e a sincronização (com a chave da Pluggy do app) leria os dados dela.
DROP POLICY IF EXISTS "Users can create their own bank connections" ON public.bank_connections;
DROP POLICY IF EXISTS "Users can create their own file connections" ON public.bank_connections;
CREATE POLICY "Users can create their own file connections"
  ON public.bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id AND provider = 'file' AND pluggy_item_id IS NULL);

-- 2) O usuário não pode trocar dono, tipo ou item da conexão; só os campos de exibição/estado.
REVOKE UPDATE ON public.bank_connections FROM authenticated, anon;
GRANT UPDATE (institution_name, status, status_detail, last_sync_at, consent_expires_at, auto_sync)
  ON public.bank_connections TO authenticated;

-- 3) Um item da Pluggy só pode estar ligado a uma conta do Nexos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT pluggy_item_id FROM public.bank_connections
    WHERE pluggy_item_id IS NOT NULL
    GROUP BY pluggy_item_id HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_connections_pluggy_item
      ON public.bank_connections (pluggy_item_id) WHERE pluggy_item_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Há itens da Pluggy repetidos em bank_connections; índice único não criado.';
  END IF;
END $$;

-- 4) Linhas filhas só podem apontar para conexões do próprio usuário
--    (evita gravar em conexão alheia e bloquear a sincronização dela com external_id repetido).
DROP POLICY IF EXISTS "Users can create their own synced transactions" ON public.synced_transactions;
CREATE POLICY "Users can create their own synced transactions"
  ON public.synced_transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can update their own synced transactions" ON public.synced_transactions;
CREATE POLICY "Users can update their own synced transactions"
  ON public.synced_transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can create their own bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can update their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can update their own bank accounts"
  ON public.bank_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create their own synced investments" ON public.synced_investments;
CREATE POLICY "Users can create their own synced investments"
  ON public.synced_investments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Users can update their own synced investments" ON public.synced_investments;
CREATE POLICY "Users can update their own synced investments"
  ON public.synced_investments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.bank_connections c WHERE c.id = bank_connection_id AND c.user_id = auth.uid())
  );
