ALTER TABLE public.eth_deployments
  ADD COLUMN IF NOT EXISTS uncx_lock_fee_wei NUMERIC NULL;