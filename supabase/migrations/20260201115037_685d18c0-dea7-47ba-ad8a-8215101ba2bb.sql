-- Create agent_tokens table for tracking tokens launched by agents
CREATE TABLE IF NOT EXISTS public.agent_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE CASCADE NOT NULL,
  source_platform TEXT DEFAULT 'api',
  source_post_id TEXT,
  source_post_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, fun_token_id)
);

-- Create agent_fee_distributions table for fee tracking
CREATE TABLE IF NOT EXISTS public.agent_fee_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE CASCADE NOT NULL,
  amount_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Add agent tracking columns to fun_tokens
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS agent_fee_share_bps INTEGER DEFAULT 8000;

-- Enable RLS on new tables
ALTER TABLE public.agent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_fee_distributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_tokens table
CREATE POLICY "Anyone can view agent tokens" 
ON public.agent_tokens FOR SELECT USING (true);

CREATE POLICY "Deny direct agent_tokens inserts" 
ON public.agent_tokens FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny direct agent_tokens updates" 
ON public.agent_tokens FOR UPDATE USING (false);

CREATE POLICY "Deny direct agent_tokens deletes" 
ON public.agent_tokens FOR DELETE USING (false);

-- RLS Policies for agent_fee_distributions table
CREATE POLICY "Anyone can view agent fee distributions" 
ON public.agent_fee_distributions FOR SELECT USING (true);

CREATE POLICY "Deny direct agent_fee_distributions inserts" 
ON public.agent_fee_distributions FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny direct agent_fee_distributions updates" 
ON public.agent_fee_distributions FOR UPDATE USING (false);

CREATE POLICY "Deny direct agent_fee_distributions deletes" 
ON public.agent_fee_distributions FOR DELETE USING (false);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent_id ON public.agent_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tokens_fun_token_id ON public.agent_tokens(fun_token_id);
CREATE INDEX IF NOT EXISTS idx_agent_fee_distributions_agent_id ON public.agent_fee_distributions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_fee_distributions_status ON public.agent_fee_distributions(status);
CREATE INDEX IF NOT EXISTS idx_fun_tokens_agent_id ON public.fun_tokens(agent_id);