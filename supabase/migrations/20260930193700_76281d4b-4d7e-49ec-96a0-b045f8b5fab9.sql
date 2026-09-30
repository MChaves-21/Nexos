-- Sincronização automática diária das conexões Pluggy (06:00 em Brasília = 09:00 UTC).
-- A função pluggy-sync-all exige o header x-cron-secret igual ao secret PLUGGY_CRON_SECRET
-- da Edge Function. Guarde o mesmo valor no Vault antes do primeiro disparo:
--   select vault.create_secret('<mesmo valor de PLUGGY_CRON_SECRET>', 'pluggy_cron_secret');
-- Sem esse secret o job roda, mas a função responde 401 e nada é sincronizado.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('pluggy-sync-all')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pluggy-sync-all');

SELECT cron.schedule(
  'pluggy-sync-all',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://pbwkhfqggfpxjqrlqxyd.supabase.co/functions/v1/pluggy-sync-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pluggy_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);