-- Add cached pool state columns to fun_tokens for server-side caching
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS holder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS market_cap_sol NUMERIC DEFAULT 30,
ADD COLUMN IF NOT EXISTS bonding_progress NUMERIC DEFAULT 0;