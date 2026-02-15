
-- Table to track tunnel distribution runs and hops
CREATE TABLE public.tunnel_distribution_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_wallet TEXT NOT NULL,
  amount_per_wallet NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tunnel_keys JSONB NOT NULL DEFAULT '[]',
  hops JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.tunnel_distribution_runs ENABLE ROW LEVEL SECURITY;

-- Public read/write since this is admin-only tool behind password + server secret
CREATE POLICY "Allow all access to tunnel_distribution_runs"
  ON public.tunnel_distribution_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);
