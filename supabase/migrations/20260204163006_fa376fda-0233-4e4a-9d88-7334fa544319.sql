-- Add bags-specific columns to fun_tokens
ALTER TABLE fun_tokens ADD COLUMN IF NOT EXISTS bags_pool_address text;
ALTER TABLE fun_tokens ADD COLUMN IF NOT EXISTS bags_creator text;
ALTER TABLE fun_tokens ADD COLUMN IF NOT EXISTS bags_signature text;

-- Create bags_fee_claims table (similar to pumpfun_fee_claims)
CREATE TABLE IF NOT EXISTS bags_fee_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id uuid REFERENCES fun_tokens(id),
  mint_address text NOT NULL,
  claimed_sol numeric NOT NULL DEFAULT 0,
  signature text,
  distributed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bags_fee_claims_token ON bags_fee_claims(fun_token_id);
CREATE INDEX IF NOT EXISTS idx_bags_fee_claims_distributed ON bags_fee_claims(distributed);
CREATE INDEX IF NOT EXISTS idx_bags_fee_claims_mint ON bags_fee_claims(mint_address);

-- Enable RLS
ALTER TABLE bags_fee_claims ENABLE ROW LEVEL SECURITY;

-- Public read policy (fees are public data)
CREATE POLICY "bags_fee_claims_select" ON bags_fee_claims FOR SELECT USING (true);

-- Backend insert/update policy
CREATE POLICY "bags_fee_claims_backend" ON bags_fee_claims FOR ALL USING (true) WITH CHECK (true);