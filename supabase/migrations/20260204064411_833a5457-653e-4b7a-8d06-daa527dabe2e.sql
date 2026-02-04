-- Create a queue table for pre-validated tweets ready to reply
CREATE TABLE public.promo_mention_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL UNIQUE,
  tweet_author TEXT,
  tweet_author_id TEXT,
  tweet_text TEXT,
  conversation_id TEXT,
  mention_type TEXT,
  follower_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  tweet_created_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, processing, sent, skipped
  processed_at TIMESTAMPTZ
);

-- Index for efficient queue processing
CREATE INDEX idx_promo_mention_queue_status ON public.promo_mention_queue(status, created_at);
CREATE INDEX idx_promo_mention_queue_tweet_id ON public.promo_mention_queue(tweet_id);

-- Enable RLS
ALTER TABLE public.promo_mention_queue ENABLE ROW LEVEL SECURITY;

-- Allow public read for admin dashboard
CREATE POLICY "Allow public read access to promo_mention_queue"
ON public.promo_mention_queue
FOR SELECT
USING (true);

-- Cleanup old queue entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_promo_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.promo_mention_queue
  WHERE created_at < now() - INTERVAL '1 hour';
END;
$$;