-- Enable RLS on the new table (backend-only access via SECURITY DEFINER functions)
ALTER TABLE public.launch_idempotency_locks ENABLE ROW LEVEL SECURITY;

-- No policies needed - all access goes through SECURITY DEFINER functions