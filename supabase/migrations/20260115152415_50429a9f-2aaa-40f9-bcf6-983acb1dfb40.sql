-- Add tracking field to prevent double distribution
ALTER TABLE public.fun_fee_claims 
ADD COLUMN creator_distributed boolean DEFAULT false,
ADD COLUMN creator_distribution_id uuid REFERENCES public.fun_distributions(id);

-- Add index for efficient querying of undistributed claims
CREATE INDEX idx_fun_fee_claims_undistributed 
ON public.fun_fee_claims (creator_distributed) 
WHERE creator_distributed = false;