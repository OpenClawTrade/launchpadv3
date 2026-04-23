-- PopShiba Bonding protocol deployment registry. One active row at a time per network.
CREATE TABLE IF NOT EXISTS public.bonding_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL CHECK (network IN ('mainnet','sepolia')),
  deployer text NOT NULL,
  factory_address text NOT NULL,
  token_impl_address text NOT NULL,
  curve_impl_address text NOT NULL,
  event_bus_address text NOT NULL,
  lp_locker_address text NOT NULL,
  treasury_address text NOT NULL,
  tx_hashes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonding_deployments_active ON public.bonding_deployments (network, is_active);

ALTER TABLE public.bonding_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bonding deployment"
  ON public.bonding_deployments FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages bonding deployments"
  ON public.bonding_deployments FOR ALL
  USING (false) WITH CHECK (false);