
-- LP positions held by platform deployer for V3 single-sided launches
CREATE TABLE public.eth_lp_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  pool_address TEXT NOT NULL,
  lp_token_id NUMERIC NOT NULL,
  creator_wallet TEXT NOT NULL,
  platform_owner TEXT NOT NULL,
  fee_tier INTEGER NOT NULL DEFAULT 10000,
  tick_lower INTEGER NOT NULL,
  tick_upper INTEGER NOT NULL,
  sqrt_price_x96 TEXT,
  chain_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eth_lp_positions_creator ON public.eth_lp_positions (lower(creator_wallet));
CREATE INDEX idx_eth_lp_positions_token ON public.eth_lp_positions (lower(token_address));

ALTER TABLE public.eth_lp_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view LP positions"
  ON public.eth_lp_positions FOR SELECT
  USING (true);

-- Fee accounting ledger: one row per token, updated on every collect()
CREATE TABLE public.eth_creator_fee_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_address TEXT NOT NULL UNIQUE,
  creator_wallet TEXT NOT NULL,
  lp_token_id NUMERIC NOT NULL,
  total_collected_weth NUMERIC NOT NULL DEFAULT 0,
  total_collected_token NUMERIC NOT NULL DEFAULT 0,
  creator_share_weth NUMERIC NOT NULL DEFAULT 0,
  creator_share_token NUMERIC NOT NULL DEFAULT 0,
  creator_paid_weth NUMERIC NOT NULL DEFAULT 0,
  creator_paid_token NUMERIC NOT NULL DEFAULT 0,
  last_collect_at TIMESTAMPTZ,
  last_claim_at TIMESTAMPTZ,
  last_claim_tx TEXT,
  chain_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eth_fee_ledger_creator ON public.eth_creator_fee_ledger (lower(creator_wallet));
CREATE INDEX idx_eth_fee_ledger_token ON public.eth_creator_fee_ledger (lower(token_address));

ALTER TABLE public.eth_creator_fee_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view fee ledger"
  ON public.eth_creator_fee_ledger FOR SELECT
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER trg_eth_lp_positions_updated
  BEFORE UPDATE ON public.eth_lp_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_eth_creator_fee_ledger_updated
  BEFORE UPDATE ON public.eth_creator_fee_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
