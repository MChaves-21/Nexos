-- Preferências de interface: modo Simples (padrão para novos usuários) ou Completo,
-- e se o primeiro acesso guiado já foi concluído.
ALTER TABLE public.profiles
  ADD COLUMN ui_mode TEXT NOT NULL DEFAULT 'simple',
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ui_mode_check CHECK (ui_mode IN ('simple', 'complete'));

-- Quem já usa o app continua vendo tudo e não passa pelo primeiro acesso de novo
UPDATE public.profiles SET ui_mode = 'complete', onboarding_completed = true;
