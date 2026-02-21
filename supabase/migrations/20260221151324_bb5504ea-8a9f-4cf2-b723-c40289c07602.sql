
CREATE OR REPLACE FUNCTION public.get_agent_token_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT json_build_object(
    'totalMarketCap', COALESCE((SELECT SUM(market_cap_sol) FROM public.fun_tokens WHERE agent_id IS NOT NULL), 0),
    'totalVolume', COALESCE((SELECT SUM(claimed_sol) FROM public.fun_fee_claims), 0),
    'totalTokensLaunched', COALESCE((SELECT COUNT(*) FROM public.fun_tokens WHERE agent_id IS NOT NULL), 0),
    'totalAgents', COALESCE((SELECT COUNT(*) FROM public.agents WHERE status = 'active'), 0),
    'totalAgentPosts', COALESCE((SELECT COUNT(*) FROM public.subtuna_posts WHERE is_agent_post = true), 0),
    'totalAgentFeesEarned', COALESCE((
      SELECT SUM(fc.claimed_sol) * 0.8
      FROM public.fun_fee_claims fc
      INNER JOIN public.fun_tokens ft ON fc.fun_token_id = ft.id
      WHERE ft.agent_id IS NOT NULL
    ), 0),
    'totalAgentPayouts', COALESCE((SELECT SUM(amount_sol) FROM public.agent_fee_distributions), 0)
  );
$$;
