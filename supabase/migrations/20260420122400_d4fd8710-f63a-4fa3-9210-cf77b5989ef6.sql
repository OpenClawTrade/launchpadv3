-- Track every Ethereum launchpad request and its on-chain progress
CREATE TABLE IF NOT EXISTS public.eth_launch_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_wallet TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_ticker TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  website_url TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  lp_eth NUMERIC NOT NULL,
  user_tax_bps INTEGER NOT NULL DEFAULT 0,
  platform_tax_bps INTEGER NOT NULL DEFAULT 100,
  burn_lp BOOLEAN NOT NULL DEFAULT true,
  renounce BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  deploy_tx_hash TEXT,
  lp_tx_hash TEXT,
  token_address TEXT,
  uniswap_pool_address TEXT,
  lp_refund_owed_eth NUMERIC NOT NULL DEFAULT 0,
  lp_refund_paid_eth NUMERIC NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eth_launch_requests_creator ON public.eth_launch_requests (lower(creator_wallet));
CREATE INDEX IF NOT EXISTS idx_eth_launch_requests_token_address ON public.eth_launch_requests (lower(token_address));
CREATE INDEX IF NOT EXISTS idx_eth_launch_requests_status ON public.eth_launch_requests (status);
CREATE INDEX IF NOT EXISTS idx_eth_launch_requests_created_at ON public.eth_launch_requests (created_at DESC);

ALTER TABLE public.eth_launch_requests ENABLE ROW LEVEL SECURITY;

-- Public read (launchpad data is public)
CREATE POLICY "ETH launches are publicly viewable"
ON public.eth_launch_requests
FOR SELECT
USING (true);

-- Only service role writes
CREATE POLICY "Service role manages ETH launches"
ON public.eth_launch_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_eth_launch_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eth_launch_requests_updated_at ON public.eth_launch_requests;
CREATE TRIGGER trg_eth_launch_requests_updated_at
BEFORE UPDATE ON public.eth_launch_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_eth_launch_requests_updated_at();