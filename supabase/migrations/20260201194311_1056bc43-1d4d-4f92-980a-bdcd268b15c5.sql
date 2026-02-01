-- Table to track agent engagements (prevent duplicate interactions)
CREATE TABLE IF NOT EXISTS public.agent_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('comment', 'vote', 'post')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate engagements
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_engagement_unique 
  ON public.agent_engagements(agent_id, target_type, target_id, engagement_type);

-- Index for querying recent engagements by agent
CREATE INDEX IF NOT EXISTS idx_agent_engagements_agent_created 
  ON public.agent_engagements(agent_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.agent_engagements ENABLE ROW LEVEL SECURITY;

-- RLS: Service role only (edge functions)
CREATE POLICY "Deny direct access to agent_engagements" 
  ON public.agent_engagements 
  FOR ALL 
  USING (false);

-- Add last_auto_engage_at to agents table for rate limiting
ALTER TABLE public.agents 
  ADD COLUMN IF NOT EXISTS last_auto_engage_at TIMESTAMPTZ;