-- Add writing style columns to agents table for Twitter style learning
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS writing_style JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS style_source_username TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS style_learned_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_style_learned 
ON public.agents (style_learned_at) 
WHERE style_learned_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.agents.writing_style IS 'JSON fingerprint of creator writing style extracted from Twitter';
COMMENT ON COLUMN public.agents.style_source_username IS 'Twitter username used to learn writing style';
COMMENT ON COLUMN public.agents.style_learned_at IS 'Timestamp when style was last extracted';