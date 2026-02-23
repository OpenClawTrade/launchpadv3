
-- Conversation history: every interaction the bot has with a user
CREATE TABLE public.x_bot_conversation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.x_bot_accounts(id) ON DELETE CASCADE,
  tweet_author_id TEXT NOT NULL,
  tweet_author_username TEXT,
  conversation_id TEXT,
  tweet_id TEXT,
  incoming_text TEXT NOT NULL,
  reply_text TEXT,
  extracted_topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by author
CREATE INDEX idx_conv_history_author ON public.x_bot_conversation_history(account_id, tweet_author_id);
CREATE INDEX idx_conv_history_conversation ON public.x_bot_conversation_history(conversation_id);
CREATE INDEX idx_conv_history_created ON public.x_bot_conversation_history(created_at DESC);

-- User topic tracking: aggregated topic counts per user
CREATE TABLE public.x_bot_user_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.x_bot_accounts(id) ON DELETE CASCADE,
  tweet_author_id TEXT NOT NULL,
  tweet_author_username TEXT,
  topic TEXT NOT NULL,
  ask_count INTEGER NOT NULL DEFAULT 1,
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, tweet_author_id, topic)
);

CREATE INDEX idx_user_topics_author ON public.x_bot_user_topics(account_id, tweet_author_id);
CREATE INDEX idx_user_topics_topic ON public.x_bot_user_topics(topic);

-- Enable RLS
ALTER TABLE public.x_bot_conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_bot_user_topics ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role)
CREATE POLICY "Service role full access" ON public.x_bot_conversation_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.x_bot_user_topics
  FOR ALL USING (true) WITH CHECK (true);
