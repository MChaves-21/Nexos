-- Revoke public execute access to update_updated_at_column function
-- This prevents potential RLS bypass if called directly
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;