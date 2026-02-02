-- Fix security definer view warning by making it security invoker
DROP VIEW IF EXISTS public.ai_usage_daily;

CREATE VIEW public.ai_usage_daily 
WITH (security_invoker = on)
AS
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