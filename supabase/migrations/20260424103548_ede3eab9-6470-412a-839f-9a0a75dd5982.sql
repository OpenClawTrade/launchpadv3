
-- Singleton deployment registry (one active row per network)
CREATE TABLE public.popv4instant_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  hook_address text NOT NULL,
  factory_address text NOT NULL,
  treasury_address text NOT NULL,
  hook_salt text NOT NULL,
  deployer text NOT NULL,
  deploy_tx_hashes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.popv4instant_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popv4instant_deployments public read"
  ON public.popv4instant_deployments FOR SELECT USING (true);

CREATE INDEX idx_popv4instant_deployments_active ON public.popv4instant_deployments(network, is_active);

-- Per-token launch records
CREATE TABLE public.popv4instant_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL UNIQUE,
  pool_id text NOT NULL,
  creator_wallet text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  description text,
  image_url text,
  twitter_url text,
  telegram_url text,
  website_url text,
  initial_buy_eth numeric NOT NULL DEFAULT 0,
  tokens_to_creator numeric NOT NULL DEFAULT 0,
  sqrt_price_x96 text NOT NULL,
  tick_lower integer NOT NULL,
  tick_upper integer NOT NULL,
  launch_tx_hash text NOT NULL,
  block_number bigint,
  market_cap_usd numeric,
  volume_eth numeric NOT NULL DEFAULT 0,
  total_trades integer NOT NULL DEFAULT 0,
  last_trade_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.popv4instant_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popv4instant_tokens public read"
  ON public.popv4instant_tokens FOR SELECT USING (true);

CREATE INDEX idx_popv4instant_tokens_creator ON public.popv4instant_tokens(creator_wallet);
CREATE INDEX idx_popv4instant_tokens_created ON public.popv4instant_tokens(created_at DESC);

CREATE TRIGGER popv4instant_tokens_updated_at
  BEFORE UPDATE ON public.popv4instant_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fee accrual + claim ledger
CREATE TABLE public.popv4instant_fees_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL,
  event_type text NOT NULL, -- 'accrued' | 'creator_claimed' | 'treasury_claimed'
  fee_in_eth boolean NOT NULL DEFAULT true,
  total_fee numeric NOT NULL DEFAULT 0,
  creator_share numeric NOT NULL DEFAULT 0,
  treasury_share numeric NOT NULL DEFAULT 0,
  eth_amount numeric NOT NULL DEFAULT 0,
  token_amount numeric NOT NULL DEFAULT 0,
  recipient text,
  tx_hash text NOT NULL,
  block_number bigint,
  log_index integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tx_hash, log_index)
);
ALTER TABLE public.popv4instant_fees_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popv4instant_fees_ledger public read"
  ON public.popv4instant_fees_ledger FOR SELECT USING (true);

CREATE INDEX idx_popv4instant_fees_token ON public.popv4instant_fees_ledger(token_address, created_at DESC);
CREATE INDEX idx_popv4instant_fees_event ON public.popv4instant_fees_ledger(event_type);
