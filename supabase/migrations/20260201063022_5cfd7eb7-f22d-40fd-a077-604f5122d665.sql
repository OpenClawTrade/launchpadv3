-- Add fee_mode column to fun_tokens
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS fee_mode TEXT DEFAULT 'creator';

COMMENT ON COLUMN public.fun_tokens.fee_mode 
IS 'Fee distribution mode: creator (50% to creator) or holder_rewards (50% to top 50 holders)';

-- Accumulator for holder reward pool (per token)
CREATE TABLE public.holder_reward_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE NOT NULL UNIQUE,
  accumulated_sol NUMERIC NOT NULL DEFAULT 0,
  last_distribution_at TIMESTAMPTZ,
  total_distributed_sol NUMERIC DEFAULT 0,
  distribution_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Distribution snapshots (audit trail)
CREATE TABLE public.holder_reward_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pool_sol NUMERIC NOT NULL,
  qualified_holders INTEGER NOT NULL DEFAULT 0,
  min_balance_required NUMERIC NOT NULL,
  status TEXT DEFAULT 'locked',
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual holder payouts per snapshot
CREATE TABLE public.holder_reward_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES holder_reward_snapshots(id) ON DELETE CASCADE NOT NULL,
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  token_balance NUMERIC NOT NULL,
  balance_share NUMERIC NOT NULL,
  payout_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  signature TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE holder_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE holder_reward_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE holder_reward_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pool" ON holder_reward_pool FOR SELECT USING (true);
CREATE POLICY "Anyone can view snapshots" ON holder_reward_snapshots FOR SELECT USING (true);
CREATE POLICY "Anyone can view payouts" ON holder_reward_payouts FOR SELECT USING (true);

-- Deny direct writes (service role only)
CREATE POLICY "Deny direct pool writes" ON holder_reward_pool FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct pool updates" ON holder_reward_pool FOR UPDATE USING (false);
CREATE POLICY "Deny direct pool deletes" ON holder_reward_pool FOR DELETE USING (false);

CREATE POLICY "Deny direct snapshot writes" ON holder_reward_snapshots FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct snapshot updates" ON holder_reward_snapshots FOR UPDATE USING (false);
CREATE POLICY "Deny direct snapshot deletes" ON holder_reward_snapshots FOR DELETE USING (false);

CREATE POLICY "Deny direct payout writes" ON holder_reward_payouts FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct payout updates" ON holder_reward_payouts FOR UPDATE USING (false);
CREATE POLICY "Deny direct payout deletes" ON holder_reward_payouts FOR DELETE USING (false);

-- Indexes for performance
CREATE INDEX idx_holder_pool_token ON holder_reward_pool(fun_token_id);
CREATE INDEX idx_holder_snapshots_token ON holder_reward_snapshots(fun_token_id);
CREATE INDEX idx_holder_snapshots_status ON holder_reward_snapshots(status);
CREATE INDEX idx_holder_payouts_snapshot ON holder_reward_payouts(snapshot_id);
CREATE INDEX idx_holder_payouts_wallet ON holder_reward_payouts(wallet_address);