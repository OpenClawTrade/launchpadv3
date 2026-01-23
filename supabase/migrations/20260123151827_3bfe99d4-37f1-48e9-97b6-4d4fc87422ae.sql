-- Create locks table for preventing overlapping cron runs
CREATE TABLE IF NOT EXISTS public.cron_locks (
  lock_name text PRIMARY KEY,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- RLS off (backend-only)
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;

-- No policies = service role only