-- Influencer list configuration
CREATE TABLE public.influencer_list_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id TEXT NOT NULL UNIQUE,
  list_name TEXT,
  is_active BOOLEAN DEFAULT true,
  reply_interval_minutes INT DEFAULT 10,
  max_replies_per_run INT DEFAULT 4,
  include_retweets BOOLEAN DEFAULT true,
  include_replies BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track all influencer replies to prevent duplicates
CREATE TABLE public.influencer_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id TEXT NOT NULL,
  influencer_username TEXT NOT NULL,
  tweet_id TEXT NOT NULL UNIQUE,
  tweet_text TEXT,
  tweet_type TEXT DEFAULT 'original', -- 'original', 'retweet', 'reply'
  reply_id TEXT,
  reply_text TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast deduplication lookups
CREATE INDEX idx_influencer_replies_tweet_id ON public.influencer_replies(tweet_id);
CREATE INDEX idx_influencer_replies_created_at ON public.influencer_replies(created_at DESC);

-- Insert the default list config
INSERT INTO public.influencer_list_config (list_id, list_name, max_replies_per_run)
VALUES ('2017170781352919333', 'Crypto Influencers', 4);

-- Enable RLS
ALTER TABLE public.influencer_list_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_replies ENABLE ROW LEVEL SECURITY;

-- Allow backend functions to manage these tables
CREATE POLICY "Backend can manage influencer config" ON public.influencer_list_config
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Backend can manage influencer replies" ON public.influencer_replies
  FOR ALL USING (true) WITH CHECK (true);