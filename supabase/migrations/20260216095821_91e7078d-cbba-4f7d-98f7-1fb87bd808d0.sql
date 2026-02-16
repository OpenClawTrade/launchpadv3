
-- Create tuna_migration_ledger table for tracking received tokens
CREATE TABLE public.tuna_migration_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  total_tokens_received NUMERIC NOT NULL DEFAULT 0,
  tx_count INTEGER NOT NULL DEFAULT 0,
  first_transfer_at TIMESTAMPTZ,
  last_transfer_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tuna_migration_ledger ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth needed)
CREATE POLICY "Anyone can view migration ledger"
  ON public.tuna_migration_ledger
  FOR SELECT
  USING (true);

-- Create index for sorting by tokens received
CREATE INDEX idx_tuna_migration_ledger_tokens ON public.tuna_migration_ledger (total_tokens_received DESC);
