DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_amount_positive') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;