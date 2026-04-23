-- Track tokens launched via Popshiba's /bonding UI through the Unicurve factory.
CREATE TABLE public.bonding_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL UNIQUE,
  curve_address TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_cid TEXT,
  image_url TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  website_url TEXT,
  salt TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  block_number BIGINT,
  initial_buy_eth NUMERIC,
  graduated BOOLEAN NOT NULL DEFAULT false,
  graduated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bonding_tokens_creator ON public.bonding_tokens(creator_address);
CREATE INDEX idx_bonding_tokens_created ON public.bonding_tokens(created_at DESC);
CREATE INDEX idx_bonding_tokens_graduated ON public.bonding_tokens(graduated);

ALTER TABLE public.bonding_tokens ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can browse the list
CREATE POLICY "Anyone can read bonding tokens"
  ON public.bonding_tokens FOR SELECT
  USING (true);

-- Public insert: client-side after launch tx confirms (no auth in this app)
CREATE POLICY "Anyone can insert bonding tokens"
  ON public.bonding_tokens FOR INSERT
  WITH CHECK (true);

-- Public update for graduation flag (called by client on chain-state change)
CREATE POLICY "Anyone can update bonding tokens"
  ON public.bonding_tokens FOR UPDATE
  USING (true);

CREATE TRIGGER update_bonding_tokens_updated_at
  BEFORE UPDATE ON public.bonding_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();