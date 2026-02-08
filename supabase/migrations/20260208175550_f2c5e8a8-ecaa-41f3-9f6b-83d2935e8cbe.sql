-- X Bot accounts configuration
CREATE TABLE public.x_bot_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  password_encrypted TEXT,
  totp_secret_encrypted TEXT,
  full_cookie_encrypted TEXT,
  auth_token_encrypted TEXT,
  ct0_token_encrypted TEXT,
  proxy_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-account targeting rules
CREATE TABLE public.x_bot_account_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.x_bot_accounts(id) ON DELETE CASCADE,
  monitored_mentions TEXT[] DEFAULT '{}',
  tracked_cashtags TEXT[] DEFAULT '{}',
  min_follower_count INTEGER DEFAULT 5000,
  require_blue_verified BOOLEAN DEFAULT true,
  require_gold_verified BOOLEAN DEFAULT false,
  author_cooldown_hours INTEGER DEFAULT 6,
  max_replies_per_thread INTEGER DEFAULT 3,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-account reply logs
CREATE TABLE public.x_bot_account_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.x_bot_accounts(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  tweet_author TEXT,
  tweet_author_id TEXT,
  tweet_text TEXT,
  conversation_id TEXT,
  reply_id TEXT,
  reply_text TEXT,
  reply_type TEXT DEFAULT 'initial',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-account tweet queue
CREATE TABLE public.x_bot_account_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.x_bot_accounts(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  tweet_author TEXT,
  tweet_author_id TEXT,
  tweet_text TEXT,
  conversation_id TEXT,
  follower_count INTEGER,
  is_verified BOOLEAN,
  match_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(account_id, tweet_id)
);

-- Enable RLS on all tables
ALTER TABLE public.x_bot_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_bot_account_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_bot_account_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_bot_account_queue ENABLE ROW LEVEL SECURITY;

-- Service role policies for edge functions
CREATE POLICY "Service role full access on x_bot_accounts"
ON public.x_bot_accounts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on x_bot_account_rules"
ON public.x_bot_account_rules FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on x_bot_account_replies"
ON public.x_bot_account_replies FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access on x_bot_account_queue"
ON public.x_bot_account_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_x_bot_accounts_active ON public.x_bot_accounts(is_active);
CREATE INDEX idx_x_bot_account_rules_account ON public.x_bot_account_rules(account_id);
CREATE INDEX idx_x_bot_account_replies_account ON public.x_bot_account_replies(account_id);
CREATE INDEX idx_x_bot_account_replies_created ON public.x_bot_account_replies(created_at DESC);
CREATE INDEX idx_x_bot_account_queue_status ON public.x_bot_account_queue(status);
CREATE INDEX idx_x_bot_account_queue_account ON public.x_bot_account_queue(account_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_x_bot_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_x_bot_accounts_updated_at
BEFORE UPDATE ON public.x_bot_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_x_bot_accounts_updated_at();