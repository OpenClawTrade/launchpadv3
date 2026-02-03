-- Create hourly_post_log table to track automated X posts
CREATE TABLE public.hourly_post_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  tweet_id TEXT,
  tweet_text TEXT,
  stats_snapshot JSONB,
  top_agent_id UUID REFERENCES public.agents(id),
  top_agent_ticker TEXT,
  hourly_fees_sol NUMERIC,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.hourly_post_log ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON public.hourly_post_log 
  FOR SELECT TO anon USING (true);