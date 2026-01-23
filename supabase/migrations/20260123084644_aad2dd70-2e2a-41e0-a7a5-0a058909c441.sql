-- Table to track X bot rate limits per Twitter user
CREATE TABLE IF NOT EXISTS public.x_bot_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  x_user_id TEXT NOT NULL,
  x_username TEXT,
  launched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_x_bot_rate_limits_user_time 
ON public.x_bot_rate_limits(x_user_id, launched_at DESC);

-- Table to track pending requests (when user mentions but no wallet)
CREATE TABLE IF NOT EXISTS public.x_pending_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL UNIQUE,
  x_user_id TEXT NOT NULL,
  x_username TEXT,
  original_tweet_text TEXT,
  original_tweet_image_url TEXT,
  our_reply_tweet_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for finding pending requests
CREATE INDEX IF NOT EXISTS idx_x_pending_requests_user 
ON public.x_pending_requests(x_user_id, status);

-- Enable RLS
ALTER TABLE public.x_bot_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_pending_requests ENABLE ROW LEVEL SECURITY;

-- Service role only policies (no public access)
CREATE POLICY "Service role only" ON public.x_bot_rate_limits
  FOR ALL USING (false);

CREATE POLICY "Service role only" ON public.x_pending_requests
  FOR ALL USING (false);