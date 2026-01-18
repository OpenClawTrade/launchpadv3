-- Add 24h price tracking columns to fun_tokens
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS price_24h_ago numeric,
ADD COLUMN IF NOT EXISTS price_change_24h numeric;

-- Create a function to snapshot prices for 24h comparison
CREATE OR REPLACE FUNCTION public.snapshot_fun_token_prices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update price_24h_ago with current price for tokens that don't have it set
  -- or where it's been more than 24 hours since last snapshot
  UPDATE fun_tokens
  SET 
    price_24h_ago = COALESCE(price_24h_ago, price_sol),
    price_change_24h = CASE 
      WHEN price_24h_ago IS NOT NULL AND price_24h_ago > 0 
      THEN ((price_sol - price_24h_ago) / price_24h_ago) * 100
      ELSE 0 
    END,
    updated_at = NOW()
  WHERE price_sol IS NOT NULL;
END;
$$;

-- Initialize price_24h_ago with current prices for existing tokens
UPDATE public.fun_tokens 
SET price_24h_ago = price_sol,
    price_change_24h = 0
WHERE price_sol IS NOT NULL AND price_24h_ago IS NULL;