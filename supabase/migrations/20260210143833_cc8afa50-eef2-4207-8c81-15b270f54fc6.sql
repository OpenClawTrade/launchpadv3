
-- Add bidding columns to claw_trading_agents
ALTER TABLE public.claw_trading_agents
  ADD COLUMN IF NOT EXISTS launched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bidding_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_wallet TEXT,
  ADD COLUMN IF NOT EXISTS is_owned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ownership_transferred_at TIMESTAMPTZ;

-- Create claw_distributions table (mirrors fun_distributions)
CREATE TABLE IF NOT EXISTS public.claw_distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fun_token_id UUID REFERENCES public.claw_tokens(id),
  creator_wallet TEXT,
  amount_sol NUMERIC NOT NULL DEFAULT 0,
  distribution_type TEXT NOT NULL DEFAULT 'creator_claim',
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  twitter_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.claw_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on claw_distributions" ON public.claw_distributions FOR SELECT USING (true);

-- Create claw_creator_claim_locks table
CREATE TABLE IF NOT EXISTS public.claw_creator_claim_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  twitter_username TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.claw_creator_claim_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on claw_creator_claim_locks" ON public.claw_creator_claim_locks FOR SELECT USING (true);

-- Create claw_agent_bids table
CREATE TABLE IF NOT EXISTS public.claw_agent_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claw_agent_id UUID REFERENCES public.claw_agents(id),
  trading_agent_id UUID REFERENCES public.claw_trading_agents(id),
  bidder_wallet TEXT NOT NULL,
  bid_amount_sol NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.claw_agent_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on claw_agent_bids" ON public.claw_agent_bids FOR SELECT USING (true);

-- RPC: acquire_claw_creator_claim_lock
CREATE OR REPLACE FUNCTION public.acquire_claw_creator_claim_lock(
  p_twitter_username TEXT,
  p_duration_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired locks
  DELETE FROM claw_creator_claim_locks WHERE expires_at < now();
  
  -- Try to insert a new lock
  INSERT INTO claw_creator_claim_locks (twitter_username, locked_at, expires_at)
  VALUES (p_twitter_username, now(), now() + (p_duration_seconds || ' seconds')::interval)
  ON CONFLICT (twitter_username) DO NOTHING;
  
  -- Check if we got the lock
  RETURN EXISTS (
    SELECT 1 FROM claw_creator_claim_locks 
    WHERE twitter_username = p_twitter_username 
    AND locked_at = (SELECT MAX(locked_at) FROM claw_creator_claim_locks WHERE twitter_username = p_twitter_username)
    AND expires_at > now()
  );
END;
$$;

-- RPC: release_claw_creator_claim_lock
CREATE OR REPLACE FUNCTION public.release_claw_creator_claim_lock(
  p_twitter_username TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM claw_creator_claim_locks WHERE twitter_username = p_twitter_username;
END;
$$;
