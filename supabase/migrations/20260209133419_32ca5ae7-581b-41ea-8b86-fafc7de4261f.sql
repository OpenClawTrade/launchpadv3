-- Add Jupiter Limit Order tracking columns to trading_agent_positions
ALTER TABLE public.trading_agent_positions
  ADD COLUMN IF NOT EXISTS limit_order_sl_pubkey text,
  ADD COLUMN IF NOT EXISTS limit_order_tp_pubkey text,
  ADD COLUMN IF NOT EXISTS limit_order_sl_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS limit_order_tp_status text DEFAULT 'none';

-- Add index for efficient order status queries
CREATE INDEX IF NOT EXISTS idx_trading_positions_limit_orders 
  ON public.trading_agent_positions (status, limit_order_sl_status, limit_order_tp_status)
  WHERE status = 'open';