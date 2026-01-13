-- Fun Launcher - Separate tables for guest meme token launches

-- Main table for fun launcher tokens
CREATE TABLE public.fun_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_wallet TEXT NOT NULL,
  mint_address TEXT,
  dbc_pool_address TEXT,
  status TEXT DEFAULT 'pending',
  price_sol NUMERIC DEFAULT 0,
  volume_24h_sol NUMERIC DEFAULT 0,
  total_fees_earned NUMERIC DEFAULT 0,
  last_distribution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fee distributions tracking
CREATE TABLE public.fun_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  amount_sol NUMERIC NOT NULL,
  signature TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS but allow public access for this guest feature
ALTER TABLE public.fun_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fun_distributions ENABLE ROW LEVEL SECURITY;

-- Public read access for fun_tokens
CREATE POLICY "Anyone can view fun tokens"
ON public.fun_tokens FOR SELECT
USING (true);

-- Public insert for fun_tokens (guest launches)
CREATE POLICY "Anyone can create fun tokens"
ON public.fun_tokens FOR INSERT
WITH CHECK (true);

-- Service role can update fun_tokens
CREATE POLICY "Service can update fun tokens"
ON public.fun_tokens FOR UPDATE
USING (true);

-- Public read access for distributions
CREATE POLICY "Anyone can view distributions"
ON public.fun_distributions FOR SELECT
USING (true);

-- Service role can insert distributions
CREATE POLICY "Service can create distributions"
ON public.fun_distributions FOR INSERT
WITH CHECK (true);

-- Index for faster queries
CREATE INDEX idx_fun_tokens_creator ON public.fun_tokens(creator_wallet);
CREATE INDEX idx_fun_tokens_status ON public.fun_tokens(status);
CREATE INDEX idx_fun_distributions_token ON public.fun_distributions(fun_token_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.fun_tokens;