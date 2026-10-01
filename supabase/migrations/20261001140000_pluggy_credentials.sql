-- Credenciais Pluggy próprias de cada usuário (ex.: cada familiar com sua conta gratuita da Pluggy).
-- O segredo fica cifrado (AES-GCM, chave derivada de um segredo do servidor) e só as Edge Functions
-- (service role) leem esta tabela. O app nunca tem acesso, nem para ler a própria linha.
CREATE TABLE IF NOT EXISTS public.pluggy_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_credentials ENABLE ROW LEVEL SECURITY;
-- Sem políticas para anon/authenticated: todo acesso pelo app é negado
REVOKE ALL ON public.pluggy_credentials FROM anon, authenticated;
GRANT ALL ON public.pluggy_credentials TO service_role;

DROP TRIGGER IF EXISTS update_pluggy_credentials_updated_at ON public.pluggy_credentials;
CREATE TRIGGER update_pluggy_credentials_updated_at
  BEFORE UPDATE ON public.pluggy_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
