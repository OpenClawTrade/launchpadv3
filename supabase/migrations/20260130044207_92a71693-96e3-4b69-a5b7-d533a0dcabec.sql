-- Table to track treasury claims from all pools (including unregistered tokens)
CREATE TABLE IF NOT EXISTS public.treasury_fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL,
  mint_address TEXT,
  token_name TEXT,
  claimed_sol NUMERIC NOT NULL DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  is_registered BOOLEAN DEFAULT false
);

-- Index for efficient queries
CREATE INDEX idx_treasury_claims_pool ON public.treasury_fee_claims(pool_address);
CREATE INDEX idx_treasury_claims_date ON public.treasury_fee_claims(claimed_at DESC);

-- RLS: Only allow service role access (no direct user access)
ALTER TABLE public.treasury_fee_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to treasury claims"
  ON public.treasury_fee_claims FOR ALL
  USING (false);

-- Backend function to insert treasury claims (bypasses RLS)
CREATE OR REPLACE FUNCTION public.backend_insert_treasury_claim(
  p_pool_address TEXT,
  p_mint_address TEXT DEFAULT NULL,
  p_token_name TEXT DEFAULT NULL,
  p_claimed_sol NUMERIC DEFAULT 0,
  p_signature TEXT DEFAULT NULL,
  p_is_registered BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.treasury_fee_claims (
    pool_address, mint_address, token_name, claimed_sol, signature, is_registered
  ) VALUES (
    p_pool_address, p_mint_address, p_token_name, p_claimed_sol, p_signature, p_is_registered
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to get treasury claims summary
CREATE OR REPLACE FUNCTION public.get_treasury_claims_summary()
RETURNS TABLE(total_claimed_sol NUMERIC, claim_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(claimed_sol), 0) AS total_claimed_sol,
    COUNT(*)::BIGINT AS claim_count
  FROM public.treasury_fee_claims;
$$;