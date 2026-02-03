-- Create pumpfun_fee_claims table for tracking pump.fun fee collections
CREATE TABLE public.pumpfun_fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES public.fun_tokens(id),
  mint_address TEXT NOT NULL,
  claimed_sol NUMERIC DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  distributed BOOLEAN DEFAULT false,
  distributed_at TIMESTAMPTZ,
  creator_amount_sol NUMERIC,
  platform_amount_sol NUMERIC,
  distribution_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_pumpfun_claims_token ON public.pumpfun_fee_claims(fun_token_id);
CREATE INDEX idx_pumpfun_claims_undistributed ON public.pumpfun_fee_claims(distributed) WHERE distributed = false;
CREATE INDEX idx_pumpfun_claims_mint ON public.pumpfun_fee_claims(mint_address);

-- Enable RLS
ALTER TABLE public.pumpfun_fee_claims ENABLE ROW LEVEL SECURITY;

-- Allow public read access (fees are public info)
CREATE POLICY "Anyone can view pumpfun fee claims"
  ON public.pumpfun_fee_claims
  FOR SELECT
  USING (true);

-- Add deployer_wallet column to fun_tokens if not exists (for pump.fun tokens)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fun_tokens' AND column_name = 'deployer_wallet') THEN
    ALTER TABLE public.fun_tokens ADD COLUMN deployer_wallet TEXT;
  END IF;
END $$;

-- Add total_fees_claimed column to fun_tokens if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'fun_tokens' AND column_name = 'total_fees_claimed') THEN
    ALTER TABLE public.fun_tokens ADD COLUMN total_fees_claimed NUMERIC DEFAULT 0;
  END IF;
END $$;