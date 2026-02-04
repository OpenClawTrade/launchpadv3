-- Create promo_mention_replies table for tracking replies to @moltbook/@openclaw mentions
CREATE TABLE public.promo_mention_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL UNIQUE,
  tweet_author TEXT NOT NULL,
  tweet_author_id TEXT,
  tweet_text TEXT,
  conversation_id TEXT,
  reply_id TEXT,
  reply_text TEXT,
  reply_type TEXT NOT NULL DEFAULT 'initial' CHECK (reply_type IN ('initial', 'followup_1', 'followup_2')),
  mention_type TEXT CHECK (mention_type IN ('moltbook', 'openclaw', 'both')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_promo_mention_replies_conversation ON public.promo_mention_replies(conversation_id);
CREATE INDEX idx_promo_mention_replies_author ON public.promo_mention_replies(tweet_author_id);
CREATE INDEX idx_promo_mention_replies_created ON public.promo_mention_replies(created_at DESC);
CREATE INDEX idx_promo_mention_replies_status ON public.promo_mention_replies(status);

-- Enable RLS
ALTER TABLE public.promo_mention_replies ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin full access to promo_mention_replies"
  ON public.promo_mention_replies
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Allow edge functions to insert/update (service role bypasses RLS)
COMMENT ON TABLE public.promo_mention_replies IS 'Tracks automated replies to tweets mentioning @moltbook or @openclaw';