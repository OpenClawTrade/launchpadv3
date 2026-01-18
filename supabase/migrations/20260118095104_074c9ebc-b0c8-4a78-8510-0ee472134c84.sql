-- =============================================
-- API LAUNCHPAD PLATFORM - Phase 1 Schema
-- =============================================

-- API Developer Accounts (wallet-based authentication)
CREATE TABLE public.api_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "ak_a1b2...")
  fee_wallet_address TEXT NOT NULL, -- Where 1.5% fees go
  terms_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, deleted
  total_fees_earned NUMERIC DEFAULT 0,
  total_fees_paid_out NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Generated Launchpads (each has separate token pool)
CREATE TABLE public.api_launchpads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_account_id UUID NOT NULL REFERENCES public.api_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE, -- e.g., "mylaunchpad" → mylaunchpad.ai67x.fun
  custom_domain TEXT,
  design_config JSONB DEFAULT '{}', -- Full builder state (colors, layout, branding)
  vercel_project_id TEXT,
  vercel_deployment_url TEXT,
  cloudflare_record_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, deploying, live, offline
  total_volume_sol NUMERIC DEFAULT 0,
  total_fees_sol NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deployed_at TIMESTAMPTZ
);

-- API Launchpad Tokens (links launchpad to its token pool)
CREATE TABLE public.api_launchpad_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launchpad_id UUID NOT NULL REFERENCES public.api_launchpads(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(launchpad_id, token_id)
);

-- Fee tracking with 1.5%/0.5% split for API launchpads
CREATE TABLE public.api_fee_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_account_id UUID NOT NULL REFERENCES public.api_accounts(id) ON DELETE CASCADE,
  launchpad_id UUID REFERENCES public.api_launchpads(id) ON DELETE SET NULL,
  token_id UUID REFERENCES public.tokens(id) ON DELETE SET NULL,
  total_fee_sol NUMERIC NOT NULL DEFAULT 0,
  api_user_share NUMERIC NOT NULL DEFAULT 0, -- 1.5% (75% of 2%)
  platform_share NUMERIC NOT NULL DEFAULT 0, -- 0.5% (25% of 2%)
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
  created_at TIMESTAMPTZ DEFAULT now(),
  distributed_at TIMESTAMPTZ
);

-- API Usage Logs for analytics
CREATE TABLE public.api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_account_id UUID NOT NULL REFERENCES public.api_accounts(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.api_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_launchpads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_launchpad_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_fee_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_accounts
CREATE POLICY "Anyone can view api accounts" ON public.api_accounts
  FOR SELECT USING (true);

CREATE POLICY "System can manage api accounts" ON public.api_accounts
  FOR ALL USING (true);

-- RLS Policies for api_launchpads
CREATE POLICY "Anyone can view live launchpads" ON public.api_launchpads
  FOR SELECT USING (status = 'live' OR true); -- All visible for gallery

CREATE POLICY "System can manage api launchpads" ON public.api_launchpads
  FOR ALL USING (true);

-- RLS Policies for api_launchpad_tokens
CREATE POLICY "Anyone can view launchpad tokens" ON public.api_launchpad_tokens
  FOR SELECT USING (true);

CREATE POLICY "System can manage launchpad tokens" ON public.api_launchpad_tokens
  FOR ALL USING (true);

-- RLS Policies for api_fee_distributions
CREATE POLICY "Anyone can view fee distributions" ON public.api_fee_distributions
  FOR SELECT USING (true);

CREATE POLICY "System can manage fee distributions" ON public.api_fee_distributions
  FOR ALL USING (true);

-- RLS Policies for api_usage_logs
CREATE POLICY "System can manage usage logs" ON public.api_usage_logs
  FOR ALL USING (true);

-- Backend functions for API account management
CREATE OR REPLACE FUNCTION public.backend_create_api_account(
  p_wallet_address TEXT,
  p_api_key_hash TEXT,
  p_api_key_prefix TEXT,
  p_fee_wallet_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.api_accounts (
    wallet_address, api_key_hash, api_key_prefix, fee_wallet_address, terms_accepted_at
  ) VALUES (
    p_wallet_address, p_api_key_hash, p_api_key_prefix, 
    COALESCE(p_fee_wallet_address, p_wallet_address),
    now()
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to get API account by wallet
CREATE OR REPLACE FUNCTION public.get_api_account_by_wallet(p_wallet_address TEXT)
RETURNS TABLE (
  id UUID,
  wallet_address TEXT,
  api_key_prefix TEXT,
  fee_wallet_address TEXT,
  status TEXT,
  total_fees_earned NUMERIC,
  total_fees_paid_out NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id, a.wallet_address, a.api_key_prefix, a.fee_wallet_address,
    a.status, a.total_fees_earned, a.total_fees_paid_out, a.created_at
  FROM public.api_accounts a
  WHERE a.wallet_address = p_wallet_address;
END;
$$;

-- Function to verify API key
CREATE OR REPLACE FUNCTION public.verify_api_key(p_api_key_hash TEXT)
RETURNS TABLE (
  id UUID,
  wallet_address TEXT,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.wallet_address, a.status
  FROM public.api_accounts a
  WHERE a.api_key_hash = p_api_key_hash AND a.status = 'active';
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_api_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_api_accounts_updated_at
  BEFORE UPDATE ON public.api_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_api_updated_at();

CREATE TRIGGER update_api_launchpads_updated_at
  BEFORE UPDATE ON public.api_launchpads
  FOR EACH ROW EXECUTE FUNCTION public.update_api_updated_at();

-- Index for faster lookups
CREATE INDEX idx_api_accounts_wallet ON public.api_accounts(wallet_address);
CREATE INDEX idx_api_launchpads_subdomain ON public.api_launchpads(subdomain);
CREATE INDEX idx_api_launchpads_status ON public.api_launchpads(status);
CREATE INDEX idx_api_fee_distributions_account ON public.api_fee_distributions(api_account_id);
CREATE INDEX idx_api_usage_logs_account ON public.api_usage_logs(api_account_id, created_at DESC);