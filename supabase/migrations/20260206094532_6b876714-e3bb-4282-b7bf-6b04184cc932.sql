-- Track Colosseum forum engagement to avoid duplicate comments
CREATE TABLE IF NOT EXISTS public.colosseum_engagement_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_post_id TEXT NOT NULL,
  target_project_name TEXT,
  target_project_slug TEXT,
  comment_body TEXT,
  comment_id TEXT,
  engagement_type TEXT DEFAULT 'comment',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(target_post_id, engagement_type)
);

-- Index for quick lookups
CREATE INDEX idx_colosseum_engagement_post ON public.colosseum_engagement_log(target_post_id);

-- RLS
ALTER TABLE public.colosseum_engagement_log ENABLE ROW LEVEL SECURITY;

-- Allow edge functions to manage
CREATE POLICY "Service role can manage colosseum engagement" 
ON public.colosseum_engagement_log FOR ALL 
USING (true) WITH CHECK (true);