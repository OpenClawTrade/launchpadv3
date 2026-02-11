
-- Create claw_bribes table
CREATE TABLE public.claw_bribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briber_wallet TEXT NOT NULL,
  parent_agent_id UUID NOT NULL REFERENCES public.claw_agents(id),
  child_agent_id UUID REFERENCES public.claw_agents(id),
  child_trading_agent_id UUID REFERENCES public.claw_trading_agents(id),
  bribe_amount_sol NUMERIC NOT NULL DEFAULT 0.5,
  bribe_wallet_address TEXT NOT NULL,
  bribe_wallet_private_key_encrypted TEXT NOT NULL,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.claw_bribes ENABLE ROW LEVEL SECURITY;

-- Public can read bribes
CREATE POLICY "Anyone can view bribes"
  ON public.claw_bribes FOR SELECT
  USING (true);

-- Public can insert (init creates via service role, but allow anon insert for the init flow)
CREATE POLICY "Anyone can create bribes"
  ON public.claw_bribes FOR INSERT
  WITH CHECK (true);
