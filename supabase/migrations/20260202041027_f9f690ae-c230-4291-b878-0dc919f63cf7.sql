-- Create twitter_style_library table for caching writing styles
CREATE TABLE public.twitter_style_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  twitter_username TEXT NOT NULL UNIQUE,
  twitter_user_id TEXT,
  writing_style JSONB NOT NULL,
  tweet_count INTEGER NOT NULL DEFAULT 0,
  learned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add style_source_twitter_url to agents table
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS style_source_twitter_url TEXT;

-- Add style_source_username to subtuna table
ALTER TABLE public.subtuna 
ADD COLUMN IF NOT EXISTS style_source_username TEXT;

-- Enable RLS on twitter_style_library
ALTER TABLE public.twitter_style_library ENABLE ROW LEVEL SECURITY;

-- Anyone can view style library (read-only for frontend display)
CREATE POLICY "Anyone can view style library"
ON public.twitter_style_library
FOR SELECT
USING (true);

-- Deny direct inserts/updates/deletes (only edge functions via service role)
CREATE POLICY "Deny direct style library inserts"
ON public.twitter_style_library
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny direct style library updates"
ON public.twitter_style_library
FOR UPDATE
USING (false);

CREATE POLICY "Deny direct style library deletes"
ON public.twitter_style_library
FOR DELETE
USING (false);

-- Create index for fast lookups
CREATE INDEX idx_twitter_style_library_username ON public.twitter_style_library(twitter_username);

-- Trigger to update updated_at
CREATE TRIGGER update_twitter_style_library_updated_at
BEFORE UPDATE ON public.twitter_style_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();