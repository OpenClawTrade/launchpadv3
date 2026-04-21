CREATE TABLE IF NOT EXISTS public.eth_deployment_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployer TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'mainnet',
  status TEXT NOT NULL DEFAULT 'in_progress',
  token_impl_address TEXT,
  clone_factory_address TEXT,
  vault_address TEXT,
  tx_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eth_deployment_progress_status
  ON public.eth_deployment_progress (status, created_at DESC);

ALTER TABLE public.eth_deployment_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access eth_deployment_progress"
  ON public.eth_deployment_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_eth_deployment_progress_updated_at
  BEFORE UPDATE ON public.eth_deployment_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();