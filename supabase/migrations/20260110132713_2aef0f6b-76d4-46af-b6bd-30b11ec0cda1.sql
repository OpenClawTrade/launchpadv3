-- Create tokens table for launched tokens
CREATE TABLE public.tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  website_url TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  discord_url TEXT,
  
  -- Creator info
  creator_wallet TEXT NOT NULL,
  creator_id UUID REFERENCES profiles(id),
  
  -- Pool addresses
  dbc_pool_address TEXT,
  damm_pool_address TEXT,
  
  -- Bonding curve state
  virtual_sol_reserves NUMERIC DEFAULT 30,
  virtual_token_reserves NUMERIC DEFAULT 1000000000,
  real_sol_reserves NUMERIC DEFAULT 0,
  real_token_reserves NUMERIC DEFAULT 0,
  total_supply NUMERIC DEFAULT 1000000000,
  bonding_curve_progress NUMERIC DEFAULT 0,
  graduation_threshold_sol NUMERIC DEFAULT 85,
  
  -- Pricing
  price_sol NUMERIC DEFAULT 0,
  market_cap_sol NUMERIC DEFAULT 0,
  volume_24h_sol NUMERIC DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'bonding', -- 'bonding', 'graduated', 'failed'
  migration_status TEXT DEFAULT 'pending', -- 'pending', 'token_created', 'dbc_active', 'graduating', 'graduated', 'failed'
  
  -- Fees
  creator_fee_bps INTEGER DEFAULT 100, -- 1%
  system_fee_bps INTEGER DEFAULT 100, -- 1%
  
  -- Stats
  holder_count INTEGER DEFAULT 0,
  
  -- Quote token (SOL or USD1)
  quote_token TEXT DEFAULT 'SOL',
  quote_decimals INTEGER DEFAULT 9,
  
  -- Fee claiming
  claim_locked_at TIMESTAMPTZ,
  last_claim_at TIMESTAMPTZ,
  system_unclaimed_sol NUMERIC DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  graduated_at TIMESTAMPTZ
);

-- Create fee_earners table
CREATE TABLE public.fee_earners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_address TEXT,
  profile_id UUID REFERENCES profiles(id),
  twitter_handle TEXT,
  
  earner_type TEXT NOT NULL, -- 'creator', 'shared', 'system'
  share_bps INTEGER NOT NULL DEFAULT 5000,
  
  total_earned_sol NUMERIC DEFAULT 0,
  unclaimed_sol NUMERIC DEFAULT 0,
  last_claimed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create launchpad transactions table
CREATE TABLE public.launchpad_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  user_profile_id UUID REFERENCES profiles(id),
  
  transaction_type TEXT NOT NULL, -- 'buy' or 'sell'
  sol_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  
  creator_fee_sol NUMERIC DEFAULT 0,
  system_fee_sol NUMERIC DEFAULT 0,
  
  signature TEXT NOT NULL,
  slot BIGINT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create token holdings table
CREATE TABLE public.token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id),
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(token_id, wallet_address)
);

-- Create fee claims table
CREATE TABLE public.fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_earner_id UUID NOT NULL REFERENCES fee_earners(id) ON DELETE CASCADE,
  amount_sol NUMERIC NOT NULL,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create fee pool claims table
CREATE TABLE public.fee_pool_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pool_address TEXT NOT NULL,
  claimed_sol NUMERIC DEFAULT 0,
  signature TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_earners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launchpad_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_pool_claims ENABLE ROW LEVEL SECURITY;

-- Tokens policies
CREATE POLICY "Anyone can view tokens" ON public.tokens FOR SELECT USING (true);
CREATE POLICY "System can manage tokens" ON public.tokens FOR ALL USING (true);

-- Fee earners policies
CREATE POLICY "Anyone can view fee earners" ON public.fee_earners FOR SELECT USING (true);
CREATE POLICY "System can manage fee earners" ON public.fee_earners FOR ALL USING (true);

-- Launchpad transactions policies
CREATE POLICY "Anyone can view launchpad transactions" ON public.launchpad_transactions FOR SELECT USING (true);
CREATE POLICY "System can manage launchpad transactions" ON public.launchpad_transactions FOR ALL USING (true);

-- Token holdings policies
CREATE POLICY "Anyone can view token holdings" ON public.token_holdings FOR SELECT USING (true);
CREATE POLICY "System can manage token holdings" ON public.token_holdings FOR ALL USING (true);

-- Fee claims policies
CREATE POLICY "Users can view their own fee claims" ON public.fee_claims FOR SELECT 
  USING (fee_earner_id IN (SELECT id FROM fee_earners WHERE profile_id = auth.uid()));
CREATE POLICY "System can manage fee claims" ON public.fee_claims FOR ALL USING (true);

-- Fee pool claims policies
CREATE POLICY "Anyone can view fee pool claims" ON public.fee_pool_claims FOR SELECT USING (true);
CREATE POLICY "System can manage fee pool claims" ON public.fee_pool_claims FOR ALL USING (true);

-- Create claim lock function
CREATE OR REPLACE FUNCTION public.acquire_claim_lock(
  p_token_id UUID, 
  p_lock_duration_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  UPDATE public.tokens
  SET claim_locked_at = now()
  WHERE id = p_token_id
    AND (claim_locked_at IS NULL OR claim_locked_at < now() - (p_lock_duration_seconds || ' seconds')::interval)
  RETURNING TRUE INTO v_locked;
  
  RETURN COALESCE(v_locked, FALSE);
END;
$$;

-- Release claim lock function
CREATE OR REPLACE FUNCTION public.release_claim_lock(p_token_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.tokens
  SET claim_locked_at = NULL, last_claim_at = now()
  WHERE id = p_token_id;
END;
$$;

-- Create updated_at trigger for tokens
CREATE TRIGGER update_tokens_updated_at
  BEFORE UPDATE ON public.tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for token_holdings
CREATE TRIGGER update_token_holdings_updated_at
  BEFORE UPDATE ON public.token_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_tokens_creator_wallet ON public.tokens(creator_wallet);
CREATE INDEX idx_tokens_status ON public.tokens(status);
CREATE INDEX idx_tokens_created_at ON public.tokens(created_at DESC);
CREATE INDEX idx_fee_earners_token_id ON public.fee_earners(token_id);
CREATE INDEX idx_fee_earners_wallet ON public.fee_earners(wallet_address);
CREATE INDEX idx_launchpad_transactions_token_id ON public.launchpad_transactions(token_id);
CREATE INDEX idx_launchpad_transactions_user ON public.launchpad_transactions(user_wallet);
CREATE INDEX idx_token_holdings_token_id ON public.token_holdings(token_id);
CREATE INDEX idx_token_holdings_wallet ON public.token_holdings(wallet_address);