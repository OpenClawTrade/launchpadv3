-- Add status column to fun_distributions if not exists
ALTER TABLE public.fun_distributions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fun_distributions_status ON public.fun_distributions(status);

-- Add trigger to update fun_tokens.updated_at
CREATE OR REPLACE FUNCTION public.update_fun_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_fun_tokens_updated_at ON public.fun_tokens;
CREATE TRIGGER update_fun_tokens_updated_at
  BEFORE UPDATE ON public.fun_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fun_tokens_updated_at();

-- Enable pg_cron extension for scheduled jobs (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;