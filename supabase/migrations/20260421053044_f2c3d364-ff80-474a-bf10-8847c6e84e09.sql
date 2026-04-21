
-- Rename table
ALTER TABLE public.base_deployments RENAME TO eth_deployments;

-- Drop old indexes/policies that reference base_*
DROP INDEX IF EXISTS public.idx_base_deployments_network;
DROP POLICY IF EXISTS "Anyone can view active deployments" ON public.eth_deployments;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_eth_deployments_network ON public.eth_deployments(network, is_active);

-- Add columns for the new contract suite (vault, clone factory, token implementation)
ALTER TABLE public.eth_deployments
  ADD COLUMN IF NOT EXISTS vault_address TEXT,
  ADD COLUMN IF NOT EXISTS clone_factory_address TEXT,
  ADD COLUMN IF NOT EXISTS token_impl_address TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

-- Recreate read policy
CREATE POLICY "Anyone can view active eth deployments"
ON public.eth_deployments
FOR SELECT
USING (is_active = true);

-- Service role manages writes (already implicit via service key bypass)
CREATE POLICY "Service role manages eth deployments"
ON public.eth_deployments
FOR ALL
USING (false)
WITH CHECK (false);
