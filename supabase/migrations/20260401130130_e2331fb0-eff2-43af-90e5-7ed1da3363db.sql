
-- Table for bank connections via Pluggy
CREATE TABLE public.bank_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  institution_name TEXT NOT NULL,
  pluggy_item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bank connections"
  ON public.bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bank connections"
  ON public.bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank connections"
  ON public.bank_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank connections"
  ON public.bank_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for synced transactions from banks
CREATE TABLE public.synced_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_connection_id UUID NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  original_category TEXT,
  ai_category TEXT,
  ai_confidence NUMERIC,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bank_connection_id, external_id)
);

ALTER TABLE public.synced_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own synced transactions"
  ON public.synced_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own synced transactions"
  ON public.synced_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own synced transactions"
  ON public.synced_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced transactions"
  ON public.synced_transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_synced_transactions_updated_at
  BEFORE UPDATE ON public.synced_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for synced_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.synced_transactions;
