-- ============================================
-- TUNA Agents v2: Enhanced Agent System
-- ============================================

-- 1. Agent verifications for Twitter-launched agents
CREATE TABLE IF NOT EXISTS public.agent_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  verified_at TIMESTAMPTZ,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_verifications_agent ON public.agent_verifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_verifications_nonce ON public.agent_verifications(nonce);

-- Enable RLS
ALTER TABLE public.agent_verifications ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role access" ON public.agent_verifications
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Agent post history for content rotation tracking
CREATE TABLE IF NOT EXISTS public.agent_post_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  subtuna_id UUID REFERENCES public.subtuna(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('professional', 'trending', 'question', 'fun', 'welcome', 'cross_visit')),
  content TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_agent_post_history_agent ON public.agent_post_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_post_history_posted_at ON public.agent_post_history(posted_at DESC);

-- Enable RLS
ALTER TABLE public.agent_post_history ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role access" ON public.agent_post_history
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Add new columns to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS has_posted_welcome BOOLEAN DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS last_cross_visit_at TIMESTAMPTZ;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 4. Update agent_social_posts to track reply context
ALTER TABLE public.agent_social_posts ADD COLUMN IF NOT EXISTS is_reply BOOLEAN DEFAULT false;
ALTER TABLE public.agent_social_posts ADD COLUMN IF NOT EXISTS parent_author_username TEXT;

-- 5. Function to create verification challenge
CREATE OR REPLACE FUNCTION public.backend_create_agent_verification(
  p_agent_id UUID
)
RETURNS TABLE(challenge TEXT, nonce TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_nonce TEXT;
  v_challenge TEXT;
  v_expires TIMESTAMPTZ;
  v_agent RECORD;
BEGIN
  -- Get agent info
  SELECT name, wallet_address INTO v_agent
  FROM agents WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;
  
  -- Generate nonce
  v_nonce := encode(gen_random_bytes(16), 'hex');
  v_expires := now() + interval '5 minutes';
  
  -- Build challenge message
  v_challenge := format(
    E'TUNA Agent Ownership Verification\n\nAgent: %s\nWallet: %s\nTimestamp: %s\nNonce: %s\n\nSign this message to prove you own this agent.',
    v_agent.name,
    v_agent.wallet_address,
    extract(epoch from now())::bigint,
    v_nonce
  );
  
  -- Delete old pending verifications for this agent
  DELETE FROM agent_verifications 
  WHERE agent_id = p_agent_id AND verified_at IS NULL;
  
  -- Insert new verification
  INSERT INTO agent_verifications (agent_id, challenge, nonce, expires_at)
  VALUES (p_agent_id, v_challenge, v_nonce, v_expires);
  
  RETURN QUERY SELECT v_challenge, v_nonce, v_expires;
END;
$$;

-- 6. Function to complete verification
CREATE OR REPLACE FUNCTION public.backend_complete_agent_verification(
  p_agent_id UUID,
  p_nonce TEXT,
  p_signature TEXT,
  p_api_key_hash TEXT,
  p_api_key_prefix TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify the challenge exists and is not expired
  UPDATE agent_verifications
  SET verified_at = now(), signature = p_signature
  WHERE agent_id = p_agent_id 
    AND nonce = p_nonce 
    AND expires_at > now()
    AND verified_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update agent with API key and verification status
  UPDATE agents
  SET 
    api_key_hash = p_api_key_hash,
    api_key_prefix = p_api_key_prefix,
    verified_at = now(),
    updated_at = now()
  WHERE id = p_agent_id;
  
  RETURN true;
END;
$$;

-- 7. Function to get agent by wallet for claim flow
CREATE OR REPLACE FUNCTION public.get_agent_by_wallet(p_wallet_address TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  wallet_address TEXT,
  verified_at TIMESTAMPTZ,
  has_api_key BOOLEAN,
  total_tokens_launched BIGINT,
  total_fees_earned_sol NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT 
    a.id,
    a.name,
    a.wallet_address,
    a.verified_at,
    (a.api_key_hash IS NOT NULL) AS has_api_key,
    COALESCE(a.total_tokens_launched, 0) AS total_tokens_launched,
    COALESCE(a.total_fees_earned_sol, 0) AS total_fees_earned_sol
  FROM agents a
  WHERE a.wallet_address = p_wallet_address
  ORDER BY a.created_at DESC
  LIMIT 1;
$$;