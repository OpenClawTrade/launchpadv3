-- Add buy_signature to sell trades so we can reference both TX hashes
-- Add verified_pnl_sol for on-chain verified PNL from Helius
ALTER TABLE public.trading_agent_trades
  ADD COLUMN IF NOT EXISTS buy_signature text,
  ADD COLUMN IF NOT EXISTS verified_pnl_sol numeric,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;