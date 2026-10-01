-- Preferências de interface: modo Simples (padrão para novos usuários) ou Completo,
-- e se o primeiro acesso guiado já foi concluído.
-- Idempotente: pode já ter sido aplicada à mão pelo SQL Editor.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_mode TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ui_mode_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_mode_check CHECK (ui_mode IN ('simple', 'complete'));
    -- Só na primeira vez: quem já usa o app continua vendo tudo e não passa pelo primeiro acesso
    UPDATE public.profiles SET ui_mode = 'complete', onboarding_completed = true;
  END IF;
END $$;
