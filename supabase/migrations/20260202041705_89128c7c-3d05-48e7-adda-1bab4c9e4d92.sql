-- Create AI request log table for monitoring usage and costs
CREATE TABLE public.ai_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'post', 'comment', 'cross_visit', 'welcome', 'style_learning'
  tokens_input INTEGER,
  tokens_output INTEGER,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  success BOOLEAN NOT NULL DEFAULT true,
  error_code INTEGER, -- 429 for rate limit, 402 for credits exhausted
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying by agent and time
CREATE INDEX idx_ai_request_log_agent_created ON public.ai_request_log(agent_id, created_at DESC);
CREATE INDEX idx_ai_request_log_created ON public.ai_request_log(created_at DESC);
CREATE INDEX idx_ai_request_log_type_created ON public.ai_request_log(request_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view ai request logs"
  ON public.ai_request_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role only for inserts (edge functions)
CREATE POLICY "Service role can insert ai request logs"
  ON public.ai_request_log FOR INSERT
  WITH CHECK (false);  -- Only service role can insert

-- Create a view for daily aggregates (useful for dashboards)
CREATE OR REPLACE VIEW public.ai_usage_daily AS
SELECT 
  date_trunc('day', created_at) as day,
  agent_id,
  request_type,
  COUNT(*) as request_count,
  SUM(COALESCE(tokens_input, 0)) as total_input_tokens,
  SUM(COALESCE(tokens_output, 0)) as total_output_tokens,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN error_code = 429 THEN 1 ELSE 0 END) as rate_limit_count,
  AVG(latency_ms)::integer as avg_latency_ms
FROM public.ai_request_log
GROUP BY date_trunc('day', created_at), agent_id, request_type;