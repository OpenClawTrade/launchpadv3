-- Create vanity_keypairs table for storing generated Solana vanity addresses
CREATE TABLE public.vanity_keypairs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suffix TEXT NOT NULL,
  public_key TEXT NOT NULL UNIQUE,
  secret_key_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used')),
  used_for_token_id UUID REFERENCES public.tokens(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vanity_keypairs ENABLE ROW LEVEL SECURITY;

-- Only allow backend functions to access (no direct client access)
CREATE POLICY "Backend access only for vanity_keypairs" 
ON public.vanity_keypairs 
FOR ALL 
USING (false);

-- Create index for fast lookups by suffix and status
CREATE INDEX idx_vanity_keypairs_suffix_status ON public.vanity_keypairs(suffix, status);
CREATE INDEX idx_vanity_keypairs_status ON public.vanity_keypairs(status);