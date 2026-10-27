ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS play_wallet NUMERIC DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS initial_play_bonus_credited BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.users
SET play_wallet = COALESCE(play_wallet, 0) + 10,
    initial_play_bonus_credited = TRUE
WHERE initial_play_bonus_credited IS DISTINCT FROM TRUE;

ALTER TABLE public.users
  ALTER COLUMN play_wallet SET DEFAULT 10,
  ALTER COLUMN initial_play_bonus_credited SET DEFAULT TRUE,
  ALTER COLUMN is_admin SET DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.admin_wallet_adjustments (
  id BIGSERIAL PRIMARY KEY,
  admin_telegram_id TEXT NOT NULL,
  target_telegram_id TEXT NOT NULL,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('main_wallet', 'play_wallet')),
  requested_delta NUMERIC NOT NULL,
  applied_delta NUMERIC NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
