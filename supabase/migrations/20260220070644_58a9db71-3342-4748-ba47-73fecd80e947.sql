
-- NFA Batches: tracks each batch of 1000 mints
CREATE TABLE public.nfa_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number INT NOT NULL UNIQUE,
  total_slots INT NOT NULL DEFAULT 1000,
  minted_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  mint_price_sol NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ
);

-- NFA Mints: individual mint records
CREATE TABLE public.nfa_mints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.nfa_batches(id),
  slot_number INT NOT NULL,
  minter_wallet TEXT NOT NULL,
  payment_signature TEXT,
  payment_verified BOOLEAN NOT NULL DEFAULT false,
  trading_agent_id UUID,
  nfa_mint_address TEXT,
  agent_name TEXT,
  agent_image_url TEXT,
  agent_personality TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(batch_id, slot_number)
);

-- Enable RLS
ALTER TABLE public.nfa_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfa_mints ENABLE ROW LEVEL SECURITY;

-- Public read on batches
CREATE POLICY "Anyone can view NFA batches"
  ON public.nfa_batches FOR SELECT
  USING (true);

-- Public read on mints
CREATE POLICY "Anyone can view NFA mints"
  ON public.nfa_mints FOR SELECT
  USING (true);

-- Only service role can insert/update (edge function handles payment verification)
-- No insert/update policies for anon/authenticated = blocked by default with RLS enabled

-- Insert first batch
INSERT INTO public.nfa_batches (batch_number) VALUES (1);
