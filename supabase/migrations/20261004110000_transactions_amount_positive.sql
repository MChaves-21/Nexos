-- Lançamento manual com valor zero ou negativo invertia os totais (o tipo Entrada/Saída já diz o sinal).
-- NOT VALID: não mexe nas linhas antigas; vale para tudo o que for criado ou alterado daqui em diante.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;
