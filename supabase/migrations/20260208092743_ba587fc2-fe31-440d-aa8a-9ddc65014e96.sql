-- Create table to track Base contract deployments
CREATE TABLE public.base_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'sepolia')),
  deployer TEXT NOT NULL,
  contracts JSONB NOT NULL,
  tx_hashes TEXT[] NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.base_deployments ENABLE ROW LEVEL SECURITY;

-- Only admins can view deployments (public read for contract addresses)
CREATE POLICY "Anyone can view active deployments"
ON public.base_deployments
FOR SELECT
USING (is_active = true);

-- Add index for network lookup
CREATE INDEX idx_base_deployments_network ON public.base_deployments(network, is_active);