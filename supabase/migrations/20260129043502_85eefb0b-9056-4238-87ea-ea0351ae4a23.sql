-- Create a table to cache pool state data across Edge Function cold starts
CREATE TABLE IF NOT EXISTS public.pool_state_cache (
  pool_address TEXT PRIMARY KEY,
  mint_address TEXT,
  price_sol NUMERIC,
  market_cap_sol NUMERIC,
  holder_count INTEGER DEFAULT 0,
  bonding_progress NUMERIC DEFAULT 0,
  real_sol_reserves NUMERIC DEFAULT 0,
  virtual_sol_reserves NUMERIC DEFAULT 30,
  virtual_token_reserves NUMERIC DEFAULT 1000000000,
  is_graduated BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pool_state_cache_updated_at ON public.pool_state_cache(updated_at);

-- Enable RLS but allow public read access (data is not sensitive)
ALTER TABLE public.pool_state_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached pool state
CREATE POLICY "Pool state cache is publicly readable"
ON public.pool_state_cache
FOR SELECT
USING (true);

-- Only service role can write (edge functions use service role)
CREATE POLICY "Service role can manage pool state cache"
ON public.pool_state_cache
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');