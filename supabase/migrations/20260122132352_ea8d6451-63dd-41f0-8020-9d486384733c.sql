-- Table to track bot replies and avoid duplicates
CREATE TABLE public.twitter_bot_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  tweet_author TEXT,
  tweet_text TEXT,
  reply_text TEXT NOT NULL,
  reply_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup of replied tweets
CREATE INDEX idx_twitter_bot_replies_tweet_id ON public.twitter_bot_replies(tweet_id);
CREATE INDEX idx_twitter_bot_replies_created_at ON public.twitter_bot_replies(created_at DESC);

-- Enable RLS (admin only access)
ALTER TABLE public.twitter_bot_replies ENABLE ROW LEVEL SECURITY;

-- Only admins can view bot replies
CREATE POLICY "Admins can view bot replies"
ON public.twitter_bot_replies
FOR SELECT
USING (public.is_admin());

-- Cleanup old replies (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_bot_replies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.twitter_bot_replies
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;