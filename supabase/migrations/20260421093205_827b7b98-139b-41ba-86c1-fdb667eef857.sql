ALTER TABLE public.eth_launch_requests
  ADD COLUMN IF NOT EXISTS uncx_lock_id NUMERIC NULL;