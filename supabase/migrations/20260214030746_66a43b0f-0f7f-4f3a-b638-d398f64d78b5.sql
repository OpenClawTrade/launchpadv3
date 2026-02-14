ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS registration_source text DEFAULT 'api';
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS external_agent_url text;