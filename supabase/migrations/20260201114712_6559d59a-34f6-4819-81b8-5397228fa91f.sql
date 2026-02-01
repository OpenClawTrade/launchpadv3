-- Create agents table for agent accounts
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  total_tokens_launched INTEGER DEFAULT 0,
  total_fees_earned_sol NUMERIC DEFAULT 0,
  total_fees_claimed_sol NUMERIC DEFAULT 0,
  last_launch_at TIMESTAMPTZ,
  launches_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on agents
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agents table
CREATE POLICY "Anyone can view agents" 
ON public.agents FOR SELECT USING (true);

CREATE POLICY "Deny direct agent inserts" 
ON public.agents FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny direct agent updates" 
ON public.agents FOR UPDATE USING (false);

CREATE POLICY "Deny direct agent deletes" 
ON public.agents FOR DELETE USING (false);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agents_wallet_address ON public.agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);