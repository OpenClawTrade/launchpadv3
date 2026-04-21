ALTER TABLE public.eth_deployments ADD COLUMN IF NOT EXISTS launcher_address text;
ALTER TABLE public.eth_launch_requests ADD COLUMN IF NOT EXISTS lp_token_id numeric;
ALTER TABLE public.eth_launch_requests ADD COLUMN IF NOT EXISTS launch_tx_hash text;