
-- Phase 1A: Add columns to nfa_mints
ALTER TABLE public.nfa_mints
  ADD COLUMN IF NOT EXISTS token_name TEXT,
  ADD COLUMN IF NOT EXISTS token_ticker TEXT,
  ADD COLUMN IF NOT EXISTS token_image_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_wallet TEXT,
  ADD COLUMN IF NOT EXISTS listed_for_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_price_sol NUMERIC;

-- Backfill owner_wallet
UPDATE public.nfa_mints SET owner_wallet = minter_wallet WHERE owner_wallet IS NULL;

-- Phase 1B: Create nfa_listings table
CREATE TABLE public.nfa_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfa_mint_id UUID NOT NULL REFERENCES public.nfa_mints(id),
  seller_wallet TEXT NOT NULL,
  asking_price_sol NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  buyer_wallet TEXT,
  sale_signature TEXT,
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nfa_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view NFA listings"
  ON public.nfa_listings FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_nfa_listings_status ON public.nfa_listings(status);
CREATE INDEX idx_nfa_listings_nfa_mint_id ON public.nfa_listings(nfa_mint_id);
CREATE INDEX idx_nfa_mints_owner_wallet ON public.nfa_mints(owner_wallet);
CREATE INDEX idx_nfa_mints_listed ON public.nfa_mints(listed_for_sale) WHERE listed_for_sale = true;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nfa_mints;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nfa_listings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
