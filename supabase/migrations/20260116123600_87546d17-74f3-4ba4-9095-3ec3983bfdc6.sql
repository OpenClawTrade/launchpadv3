-- Aggregate summary for Fun fee claims (used for totals independent of pagination)
CREATE OR REPLACE FUNCTION public.get_fun_fee_claims_summary()
RETURNS TABLE(
  total_claimed_sol double precision,
  claim_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(claimed_sol), 0)::double precision AS total_claimed_sol,
    COUNT(*)::bigint AS claim_count
  FROM public.fun_fee_claims;
$$;