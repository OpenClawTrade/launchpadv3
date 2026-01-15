-- Create table for trending tokens from DexScreener
CREATE TABLE public.trending_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rank INTEGER NOT NULL,
  token_address TEXT NOT NULL,
  chain_id TEXT NOT NULL DEFAULT 'solana',
  name TEXT,
  symbol TEXT,
  description TEXT,
  image_url TEXT,
  url TEXT,
  total_amount BIGINT,
  amount BIGINT,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on token_address to allow upserts
CREATE UNIQUE INDEX idx_trending_tokens_address ON public.trending_tokens(token_address);

-- Create table for analyzed narratives
CREATE TABLE public.trending_narratives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  narrative TEXT NOT NULL,
  description TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  example_tokens TEXT[], -- array of token names/symbols
  popularity_score NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false, -- current narrative for token generation
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for finding active narrative
CREATE INDEX idx_trending_narratives_active ON public.trending_narratives(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.trending_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_narratives ENABLE ROW LEVEL SECURITY;

-- Public read access for both tables
CREATE POLICY "Trending tokens are viewable by everyone" 
ON public.trending_tokens FOR SELECT USING (true);

CREATE POLICY "Trending narratives are viewable by everyone" 
ON public.trending_narratives FOR SELECT USING (true);