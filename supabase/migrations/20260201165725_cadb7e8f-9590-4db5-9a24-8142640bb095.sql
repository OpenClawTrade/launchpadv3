-- Create table to track processed social posts for agent token launches
CREATE TABLE public.agent_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'telegram')),
  post_id TEXT NOT NULL,
  post_url TEXT,
  post_author TEXT,
  post_author_id TEXT,
  wallet_address TEXT NOT NULL,
  agent_id UUID REFERENCES public.agents(id),
  fun_token_id UUID REFERENCES public.fun_tokens(id),
  raw_content TEXT,
  parsed_name TEXT,
  parsed_symbol TEXT,
  parsed_description TEXT,
  parsed_image_url TEXT,
  parsed_website TEXT,
  parsed_twitter TEXT,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'duplicate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(platform, post_id)
);

-- Create index for efficient lookups
CREATE INDEX idx_agent_social_posts_status ON public.agent_social_posts(status);
CREATE INDEX idx_agent_social_posts_platform_post_id ON public.agent_social_posts(platform, post_id);
CREATE INDEX idx_agent_social_posts_wallet ON public.agent_social_posts(wallet_address);

-- Enable RLS
ALTER TABLE public.agent_social_posts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view social posts"
ON public.agent_social_posts
FOR SELECT
USING (true);

CREATE POLICY "Deny direct social posts inserts"
ON public.agent_social_posts
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny direct social posts updates"
ON public.agent_social_posts
FOR UPDATE
USING (false);

CREATE POLICY "Deny direct social posts deletes"
ON public.agent_social_posts
FOR DELETE
USING (false);