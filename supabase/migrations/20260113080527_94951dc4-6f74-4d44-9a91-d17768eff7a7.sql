-- Create fun_fee_claims table to track fee claims from pools
CREATE TABLE public.fun_fee_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fun_token_id UUID REFERENCES public.fun_tokens(id),
  pool_address TEXT NOT NULL,
  claimed_sol NUMERIC NOT NULL DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create fun_buybacks table to track buyback transactions
CREATE TABLE public.fun_buybacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fun_token_id UUID REFERENCES public.fun_tokens(id),
  amount_sol NUMERIC NOT NULL,
  tokens_bought NUMERIC,
  signature TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add distribution_type to fun_distributions to differentiate creator/system
ALTER TABLE public.fun_distributions 
ADD COLUMN IF NOT EXISTS distribution_type TEXT DEFAULT 'creator';

-- Enable RLS
ALTER TABLE public.fun_fee_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fun_buybacks ENABLE ROW LEVEL SECURITY;

-- RLS policies for fun_fee_claims
CREATE POLICY "Anyone can view fun fee claims" ON public.fun_fee_claims FOR SELECT USING (true);
CREATE POLICY "System can manage fun fee claims" ON public.fun_fee_claims FOR ALL USING (true);

-- RLS policies for fun_buybacks
CREATE POLICY "Anyone can view fun buybacks" ON public.fun_buybacks FOR SELECT USING (true);
CREATE POLICY "System can manage fun buybacks" ON public.fun_buybacks FOR ALL USING (true);