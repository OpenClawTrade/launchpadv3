
-- Add bid wallet (dedicated per-agent wallet for receiving bids) to claw_trading_agents
ALTER TABLE public.claw_trading_agents
  ADD COLUMN IF NOT EXISTS bid_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS bid_wallet_private_key_encrypted TEXT;

-- Add refund tracking to claw_agent_bids  
ALTER TABLE public.claw_agent_bids
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_signature TEXT,
  ADD COLUMN IF NOT EXISTS tx_signature TEXT;

-- Update existing bidding_ends_at default comment (3h window now)
COMMENT ON COLUMN public.claw_trading_agents.bidding_ends_at IS 'Bidding ends 3 hours after launch';
