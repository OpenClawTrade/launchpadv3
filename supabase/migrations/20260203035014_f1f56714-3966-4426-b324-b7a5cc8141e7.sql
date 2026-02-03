-- Enable RLS on creator_claim_locks
ALTER TABLE public.creator_claim_locks ENABLE ROW LEVEL SECURITY;

-- Only backend can access this table (service role)
CREATE POLICY "Deny direct access to creator_claim_locks" 
ON public.creator_claim_locks 
FOR ALL 
USING (false);