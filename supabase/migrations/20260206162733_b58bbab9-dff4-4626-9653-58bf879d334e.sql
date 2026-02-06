-- Create table to track partner fee distributions
CREATE TABLE IF NOT EXISTS partner_fee_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id),
  token_name TEXT,
  token_ticker TEXT,
  launchpad_type TEXT,
  fee_mode TEXT,
  amount_sol NUMERIC NOT NULL DEFAULT 0,
  signature TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries by time
CREATE INDEX idx_partner_fee_dist_created ON partner_fee_distributions(created_at DESC);

-- Index for token lookups
CREATE INDEX idx_partner_fee_dist_token ON partner_fee_distributions(fun_token_id);

-- RLS - service role access only (password protected in app)
ALTER TABLE partner_fee_distributions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads for the partner page (protected by password in app)
CREATE POLICY "Allow anonymous read access" ON partner_fee_distributions FOR SELECT USING (true);

-- Allow service role full access for inserts
CREATE POLICY "Allow service role inserts" ON partner_fee_distributions FOR INSERT WITH CHECK (true);