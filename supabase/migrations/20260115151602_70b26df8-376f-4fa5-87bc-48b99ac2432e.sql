-- Add unique constraint on signature to prevent duplicate claims
ALTER TABLE public.fun_fee_claims ADD CONSTRAINT fun_fee_claims_signature_unique UNIQUE (signature);