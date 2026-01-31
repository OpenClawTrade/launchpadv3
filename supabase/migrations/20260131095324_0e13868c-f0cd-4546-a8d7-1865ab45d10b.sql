-- Fix search_path for the get_api_leaderboard function
CREATE OR REPLACE FUNCTION get_api_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  total_fees_earned NUMERIC,
  total_fees_paid_out NUMERIC,
  tokens_launched BIGINT,
  launchpads_count BIGINT,
  member_since TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY aa.total_fees_earned DESC NULLS LAST) as rank,
    aa.wallet_address,
    COALESCE(aa.total_fees_earned, 0) as total_fees_earned,
    COALESCE(aa.total_fees_paid_out, 0) as total_fees_paid_out,
    COALESCE(
      (SELECT COUNT(*) FROM public.fun_tokens ft WHERE ft.api_account_id = aa.id),
      0
    ) as tokens_launched,
    COALESCE(
      (SELECT COUNT(*) FROM public.api_launchpads al WHERE al.api_account_id = aa.id),
      0
    ) as launchpads_count,
    aa.created_at as member_since
  FROM public.api_accounts aa
  WHERE aa.status = 'active'
  ORDER BY aa.total_fees_earned DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;