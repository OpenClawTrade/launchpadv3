
-- Migration config table (single row)
CREATE TABLE public.tuna_migration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_at timestamptz NOT NULL,
  old_mint_address text NOT NULL,
  collection_wallet text NOT NULL,
  total_supply_snapshot numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tuna_migration_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view migration config"
  ON public.tuna_migration_config FOR SELECT
  USING (true);

-- Snapshot holders table
CREATE TABLE public.tuna_migration_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  token_balance numeric NOT NULL DEFAULT 0,
  supply_percentage numeric NOT NULL DEFAULT 0,
  has_migrated boolean NOT NULL DEFAULT false,
  amount_sent numeric DEFAULT 0,
  tx_signature text,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tuna_migration_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view snapshot"
  ON public.tuna_migration_snapshot FOR SELECT
  USING (true);

-- Security definer function to submit migration (prevents direct table manipulation)
CREATE OR REPLACE FUNCTION public.submit_tuna_migration(
  p_wallet_address text,
  p_amount_sent numeric,
  p_tx_signature text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deadline timestamptz;
BEGIN
  -- Check deadline
  SELECT deadline_at INTO v_deadline FROM public.tuna_migration_config LIMIT 1;
  IF v_deadline IS NOT NULL AND now() > v_deadline THEN
    RAISE EXCEPTION 'Migration window has closed';
  END IF;

  -- Check wallet is in snapshot
  IF NOT EXISTS (SELECT 1 FROM public.tuna_migration_snapshot WHERE wallet_address = p_wallet_address) THEN
    RAISE EXCEPTION 'Wallet not found in snapshot';
  END IF;

  -- Update migration status
  UPDATE public.tuna_migration_snapshot
  SET has_migrated = true,
      amount_sent = p_amount_sent,
      tx_signature = p_tx_signature,
      migrated_at = now()
  WHERE wallet_address = p_wallet_address;

  RETURN true;
END;
$$;
