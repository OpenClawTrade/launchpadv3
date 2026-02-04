-- Add missing columns to existing pumpfun_trending_tokens table
ALTER TABLE public.pumpfun_trending_tokens
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS price_sol numeric,
ADD COLUMN IF NOT EXISTS liquidity_sol numeric,
ADD COLUMN IF NOT EXISTS age_hours numeric,
ADD COLUMN IF NOT EXISTS volume_trend text,
ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS narrative_category text;

-- Create index on token_score (the actual column name)
CREATE INDEX IF NOT EXISTS idx_pumpfun_score ON pumpfun_trending_tokens(token_score DESC NULLS LAST);

-- Add last_trade_at to trading_agents
ALTER TABLE public.trading_agents
ADD COLUMN IF NOT EXISTS last_trade_at timestamp with time zone;