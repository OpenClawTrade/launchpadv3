-- 1. Trade history per bonding token
CREATE TABLE IF NOT EXISTS public.bonding_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  curve_address TEXT NOT NULL,
  trader_address TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  eth_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  price_eth NUMERIC,
  price_usd NUMERIC,
  tx_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT,
  log_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bonding_trades_token ON public.bonding_trades(token_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonding_trades_trader ON public.bonding_trades(trader_address, created_at DESC);
ALTER TABLE public.bonding_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades public read" ON public.bonding_trades FOR SELECT USING (true);
CREATE POLICY "trades anon insert" ON public.bonding_trades FOR INSERT WITH CHECK (true);

-- 2. Holder balances per token
CREATE TABLE IF NOT EXISTS public.bonding_holders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  holder_address TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token_address, holder_address)
);
CREATE INDEX IF NOT EXISTS idx_bonding_holders_token ON public.bonding_holders(token_address, balance DESC);
ALTER TABLE public.bonding_holders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holders public read" ON public.bonding_holders FOR SELECT USING (true);
CREATE POLICY "holders anon upsert" ON public.bonding_holders FOR INSERT WITH CHECK (true);
CREATE POLICY "holders anon update" ON public.bonding_holders FOR UPDATE USING (true);

-- 3. Cached metrics on the token row (so list-page doesn't fan out 100 RPC calls)
ALTER TABLE public.bonding_tokens
  ADD COLUMN IF NOT EXISTS market_cap_usd     NUMERIC,
  ADD COLUMN IF NOT EXISTS price_eth          NUMERIC,
  ADD COLUMN IF NOT EXISTS real_eth_reserves  NUMERIC,
  ADD COLUMN IF NOT EXISTS real_token_reserves NUMERIC,
  ADD COLUMN IF NOT EXISTS progress_bps       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS holder_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_trade_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_trades       INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bonding_tokens_progress ON public.bonding_tokens(progress_bps DESC);
CREATE INDEX IF NOT EXISTS idx_bonding_tokens_mcap ON public.bonding_tokens(market_cap_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bonding_tokens_lasttrade ON public.bonding_tokens(last_trade_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_bonding_tokens_creator ON public.bonding_tokens(creator_address);