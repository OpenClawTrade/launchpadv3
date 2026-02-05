-- Create deployer_wallets table for tracking fresh deployer wallets
CREATE TABLE public.deployer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  token_mint TEXT,
  funded_sol NUMERIC DEFAULT 0.05,
  remaining_sol NUMERIC DEFAULT 0,
  reclaimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deployer_wallets ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access this table
-- This is intentional as it contains encrypted private keys

-- Create index for faster lookups
CREATE INDEX idx_deployer_wallets_reclaimed ON public.deployer_wallets (reclaimed_at) WHERE reclaimed_at IS NULL;
CREATE INDEX idx_deployer_wallets_token_mint ON public.deployer_wallets (token_mint);