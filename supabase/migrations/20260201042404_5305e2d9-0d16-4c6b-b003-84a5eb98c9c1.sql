-- Add trading_fee_bps column to fun_tokens to support custom trading fees
-- Default is 200 (2%) to match existing tokens
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS trading_fee_bps integer DEFAULT 200;

-- Add comment for clarity
COMMENT ON COLUMN public.fun_tokens.trading_fee_bps IS 'Trading fee in basis points (e.g., 200 = 2%). Default is 200.';