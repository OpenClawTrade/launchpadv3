-- Add multi-chain support to fun_tokens
ALTER TABLE public.fun_tokens 
  ADD COLUMN IF NOT EXISTS chain TEXT DEFAULT 'solana',
  ADD COLUMN IF NOT EXISTS chain_id INTEGER,
  ADD COLUMN IF NOT EXISTS evm_token_address TEXT,
  ADD COLUMN IF NOT EXISTS evm_pool_address TEXT,
  ADD COLUMN IF NOT EXISTS evm_factory_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS creator_fee_bps INTEGER DEFAULT 8000,
  ADD COLUMN IF NOT EXISTS fair_launch_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fair_launch_duration_mins INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS starting_mcap_usd NUMERIC DEFAULT 5000;

-- Create indexes for chain queries
CREATE INDEX IF NOT EXISTS idx_fun_tokens_chain ON public.fun_tokens(chain);
CREATE INDEX IF NOT EXISTS idx_fun_tokens_chain_id ON public.fun_tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_fun_tokens_evm_token_address ON public.fun_tokens(evm_token_address);

-- Creator fee claims for Base tokens
CREATE TABLE IF NOT EXISTS public.base_creator_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  claimed_eth NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on base_creator_claims
ALTER TABLE public.base_creator_claims ENABLE ROW LEVEL SECURITY;

-- RLS policies for base_creator_claims
CREATE POLICY "Anyone can view base creator claims"
  ON public.base_creator_claims
  FOR SELECT
  USING (true);

CREATE POLICY "Deny direct base creator claims inserts"
  ON public.base_creator_claims
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Deny direct base creator claims updates"
  ON public.base_creator_claims
  FOR UPDATE
  USING (false);

CREATE POLICY "Deny direct base creator claims deletes"
  ON public.base_creator_claims
  FOR DELETE
  USING (false);

-- Buyback events tracking for Base
CREATE TABLE IF NOT EXISTS public.base_buybacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE CASCADE,
  eth_amount NUMERIC NOT NULL,
  tokens_bought NUMERIC,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on base_buybacks
ALTER TABLE public.base_buybacks ENABLE ROW LEVEL SECURITY;

-- RLS policies for base_buybacks
CREATE POLICY "Anyone can view base buybacks"
  ON public.base_buybacks
  FOR SELECT
  USING (true);

CREATE POLICY "Deny direct base buybacks inserts"
  ON public.base_buybacks
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Deny direct base buybacks updates"
  ON public.base_buybacks
  FOR UPDATE
  USING (false);

CREATE POLICY "Deny direct base buybacks deletes"
  ON public.base_buybacks
  FOR DELETE
  USING (false);

-- Backend function to create Base tokens
CREATE OR REPLACE FUNCTION public.backend_create_base_token(
  p_name TEXT,
  p_ticker TEXT,
  p_creator_wallet TEXT,
  p_evm_token_address TEXT,
  p_evm_pool_address TEXT,
  p_evm_factory_tx_hash TEXT,
  p_creator_fee_bps INTEGER DEFAULT 8000,
  p_fair_launch_duration_mins INTEGER DEFAULT 5,
  p_starting_mcap_usd NUMERIC DEFAULT 5000,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_website_url TEXT DEFAULT NULL,
  p_twitter_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_fair_launch_ends_at TIMESTAMPTZ;
BEGIN
  v_fair_launch_ends_at := now() + (p_fair_launch_duration_mins || ' minutes')::interval;
  
  INSERT INTO public.fun_tokens (
    name, ticker, creator_wallet, chain, chain_id,
    evm_token_address, evm_pool_address, evm_factory_tx_hash,
    creator_fee_bps, fair_launch_ends_at, fair_launch_duration_mins,
    starting_mcap_usd, description, image_url, website_url, twitter_url,
    status
  ) VALUES (
    p_name, p_ticker, p_creator_wallet, 'base', 8453,
    p_evm_token_address, p_evm_pool_address, p_evm_factory_tx_hash,
    p_creator_fee_bps, v_fair_launch_ends_at, p_fair_launch_duration_mins,
    p_starting_mcap_usd, p_description, p_image_url, p_website_url, p_twitter_url,
    'active'
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Backend function to record Base creator claim
CREATE OR REPLACE FUNCTION public.backend_record_base_claim(
  p_fun_token_id UUID,
  p_creator_wallet TEXT,
  p_claimed_eth NUMERIC,
  p_tx_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.base_creator_claims (
    fun_token_id, creator_wallet, claimed_eth, tx_hash
  ) VALUES (
    p_fun_token_id, p_creator_wallet, p_claimed_eth, p_tx_hash
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Backend function to record Base buyback
CREATE OR REPLACE FUNCTION public.backend_record_base_buyback(
  p_fun_token_id UUID,
  p_eth_amount NUMERIC,
  p_tokens_bought NUMERIC,
  p_tx_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.base_buybacks (
    fun_token_id, eth_amount, tokens_bought, tx_hash
  ) VALUES (
    p_fun_token_id, p_eth_amount, p_tokens_bought, p_tx_hash
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;