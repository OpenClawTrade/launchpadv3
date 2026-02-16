
-- Create a table to track individual migration transactions
CREATE TABLE public.tuna_migration_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  tx_signature text UNIQUE NOT NULL,
  amount_sent numeric NOT NULL DEFAULT 0,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tuna_migration_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view migration transactions"
  ON public.tuna_migration_transactions FOR SELECT
  USING (true);

-- Create index for fast wallet lookups
CREATE INDEX idx_migration_txs_wallet ON public.tuna_migration_transactions(wallet_address);
