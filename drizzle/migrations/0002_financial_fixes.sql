CREATE OR REPLACE FUNCTION public.import_synced_transactions(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  imported integer;
BEGIN
  WITH items AS (
    SELECT DISTINCT ON ((e->>'id')::uuid)
      (e->>'id')::uuid AS id,
      nullif(left(trim(e->>'category'), 60), '') AS category
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS e
  ),
  picked AS (
    UPDATE public.synced_transactions st
    SET is_reviewed = true
    FROM items
    WHERE st.id = items.id
      AND st.user_id = auth.uid()
      AND NOT st.is_reviewed
    RETURNING st.user_id, st.type, st.description, st.installment_info, st.amount, st.date,
              coalesce(items.category, st.ai_category, 'Outros') AS category
  )
  INSERT INTO public.transactions (user_id, type, description, category, amount, date)
  SELECT user_id,
         CASE WHEN type = 'income' THEN 'income' ELSE 'expense' END,
         CASE WHEN installment_info IS NULL THEN description ELSE description || ' (' || installment_info || ')' END,
         category,
         amount,
         date
  FROM picked
  WHERE amount > 0;
  GET DIAGNOSTICS imported = ROW_COUNT;
  RETURN imported;
END;
$$;

REVOKE ALL ON FUNCTION public.import_synced_transactions(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_synced_transactions(jsonb) TO authenticated, service_role;

UPDATE public.synced_transactions
SET ai_category = NULL, ai_confidence = NULL, category_source = NULL
WHERE category_source = 'rule'
  AND ai_category = 'Transferência'
  AND description ~* '(pix|ted|transfer)'
  AND description !~* '(pagamento (de|da) fatura|pagamento recebido|mesma titularidade)';

DELETE FROM public.categorization_rules
WHERE keyword ~ '^(transferencia|transf|pix|ted|doc|enviada|enviado|recebida|recebido|pelo|por|via)( (transferencia|transf|pix|ted|doc|enviada|enviado|recebida|recebido|pelo|por|via))*$';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'bank_connections' AND column_name = 'bank_updated_at') THEN
    GRANT UPDATE (bank_updated_at) ON public.bank_connections TO authenticated;
  END IF;
END $$;