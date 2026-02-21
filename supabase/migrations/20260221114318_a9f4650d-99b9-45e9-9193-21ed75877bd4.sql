-- Add cached X profile columns to fun_tokens
ALTER TABLE public.fun_tokens
  ADD COLUMN IF NOT EXISTS twitter_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS twitter_verified_type TEXT DEFAULT 'none';