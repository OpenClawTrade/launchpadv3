-- Prevent duplicate open positions on same token for same agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_position_per_token
ON public.trading_agent_positions (trading_agent_id, token_address)
WHERE status = 'open';