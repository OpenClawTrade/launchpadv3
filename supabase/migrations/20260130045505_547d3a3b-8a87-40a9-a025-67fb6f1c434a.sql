-- Table to cache discovered pools during scanning
CREATE TABLE IF NOT EXISTS public.treasury_pool_cache (
  pool_address TEXT PRIMARY KEY,
  mint_address TEXT,
  token_name TEXT,
  is_registered BOOLEAN DEFAULT false,
  registered_in TEXT,
  claimable_sol NUMERIC DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_treasury_pool_cache_claimable ON public.treasury_pool_cache(claimable_sol DESC);

-- RLS: Deny direct access
ALTER TABLE public.treasury_pool_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to treasury pool cache"
  ON public.treasury_pool_cache FOR ALL
  USING (false);

-- Function to upsert pool cache entries
CREATE OR REPLACE FUNCTION public.backend_upsert_pool_cache(
  p_pool_address TEXT,
  p_mint_address TEXT DEFAULT NULL,
  p_token_name TEXT DEFAULT NULL,
  p_is_registered BOOLEAN DEFAULT false,
  p_registered_in TEXT DEFAULT NULL,
  p_claimable_sol NUMERIC DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.treasury_pool_cache (
    pool_address, mint_address, token_name, is_registered, registered_in, claimable_sol, last_checked_at
  ) VALUES (
    p_pool_address, p_mint_address, p_token_name, p_is_registered, p_registered_in, p_claimable_sol, now()
  )
  ON CONFLICT (pool_address) DO UPDATE SET
    mint_address = COALESCE(EXCLUDED.mint_address, treasury_pool_cache.mint_address),
    token_name = COALESCE(EXCLUDED.token_name, treasury_pool_cache.token_name),
    is_registered = EXCLUDED.is_registered,
    registered_in = EXCLUDED.registered_in,
    claimable_sol = EXCLUDED.claimable_sol,
    last_checked_at = now();
END;
$$;

-- Function to get cached pools
CREATE OR REPLACE FUNCTION public.get_treasury_pool_cache()
RETURNS TABLE(
  pool_address TEXT,
  mint_address TEXT,
  token_name TEXT,
  is_registered BOOLEAN,
  registered_in TEXT,
  claimable_sol NUMERIC,
  last_checked_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    pool_address, mint_address, token_name, is_registered, 
    registered_in, claimable_sol, last_checked_at, discovered_at
  FROM public.treasury_pool_cache
  ORDER BY claimable_sol DESC NULLS LAST;
$$;