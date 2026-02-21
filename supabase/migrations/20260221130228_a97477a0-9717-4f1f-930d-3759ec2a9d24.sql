
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE (
  total_mcap_sol NUMERIC,
  total_fees_earned NUMERIC,
  token_count BIGINT,
  total_fee_claims NUMERIC,
  total_agent_payouts NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    COALESCE((SELECT SUM(market_cap_sol) FROM public.fun_tokens), 0) as total_mcap_sol,
    COALESCE((SELECT SUM(total_fees_earned) FROM public.fun_tokens), 0) as total_fees_earned,
    COALESCE((SELECT COUNT(*) FROM public.fun_tokens), 0) as token_count,
    COALESCE((SELECT SUM(claimed_sol) FROM public.fun_fee_claims), 0) as total_fee_claims,
    COALESCE((SELECT SUM(amount_sol) FROM public.agent_fee_distributions), 0) as total_agent_payouts;
$$;
