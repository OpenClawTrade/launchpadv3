-- Create backend function for upserting token holdings
CREATE OR REPLACE FUNCTION public.backend_upsert_token_holding(
  p_token_id UUID,
  p_wallet_address TEXT,
  p_balance_delta NUMERIC,
  p_profile_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.token_holdings (token_id, wallet_address, balance, profile_id)
  VALUES (p_token_id, p_wallet_address, p_balance_delta, p_profile_id)
  ON CONFLICT (token_id, wallet_address) DO UPDATE
  SET balance = COALESCE(token_holdings.balance, 0) + p_balance_delta,
      profile_id = COALESCE(p_profile_id, token_holdings.profile_id),
      updated_at = now();
END;
$$;

-- Create backend function for recording transactions
CREATE OR REPLACE FUNCTION public.backend_record_transaction(
  p_token_id UUID,
  p_user_wallet TEXT,
  p_transaction_type TEXT,
  p_sol_amount NUMERIC,
  p_token_amount NUMERIC,
  p_price_per_token NUMERIC,
  p_signature TEXT,
  p_system_fee_sol NUMERIC DEFAULT 0,
  p_creator_fee_sol NUMERIC DEFAULT 0,
  p_user_profile_id UUID DEFAULT NULL,
  p_slot INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.launchpad_transactions (
    token_id, user_wallet, transaction_type, sol_amount, token_amount,
    price_per_token, signature, system_fee_sol, creator_fee_sol,
    user_profile_id, slot
  ) VALUES (
    p_token_id, p_user_wallet, p_transaction_type, p_sol_amount, p_token_amount,
    p_price_per_token, p_signature, p_system_fee_sol, p_creator_fee_sol,
    p_user_profile_id, p_slot
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create backend function for updating token state after swap
CREATE OR REPLACE FUNCTION public.backend_update_token_state(
  p_token_id UUID,
  p_virtual_sol_reserves NUMERIC,
  p_virtual_token_reserves NUMERIC,
  p_real_sol_reserves NUMERIC,
  p_real_token_reserves NUMERIC,
  p_price_sol NUMERIC,
  p_market_cap_sol NUMERIC,
  p_bonding_curve_progress NUMERIC,
  p_volume_delta NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tokens SET
    virtual_sol_reserves = p_virtual_sol_reserves,
    virtual_token_reserves = p_virtual_token_reserves,
    real_sol_reserves = p_real_sol_reserves,
    real_token_reserves = p_real_token_reserves,
    price_sol = p_price_sol,
    market_cap_sol = p_market_cap_sol,
    bonding_curve_progress = p_bonding_curve_progress,
    volume_24h_sol = COALESCE(volume_24h_sol, 0) + p_volume_delta,
    updated_at = now()
  WHERE id = p_token_id;
END;
$$;

-- Create backend function for updating fee earners
CREATE OR REPLACE FUNCTION public.backend_update_fee_earner(
  p_token_id UUID,
  p_earner_type TEXT,
  p_fee_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.fee_earners SET
    unclaimed_sol = COALESCE(unclaimed_sol, 0) + p_fee_amount,
    total_earned_sol = COALESCE(total_earned_sol, 0) + p_fee_amount
  WHERE token_id = p_token_id AND earner_type = p_earner_type;
END;
$$;

-- Create backend function for updating holder count
CREATE OR REPLACE FUNCTION public.backend_update_holder_count(p_token_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tokens SET
    holder_count = (
      SELECT COUNT(*) FROM public.token_holdings 
      WHERE token_id = p_token_id AND balance > 0
    ),
    updated_at = now()
  WHERE id = p_token_id;
END;
$$;

-- Grant execute permissions to anon role
GRANT EXECUTE ON FUNCTION public.backend_upsert_token_holding TO anon;
GRANT EXECUTE ON FUNCTION public.backend_record_transaction TO anon;
GRANT EXECUTE ON FUNCTION public.backend_update_token_state TO anon;
GRANT EXECUTE ON FUNCTION public.backend_update_fee_earner TO anon;
GRANT EXECUTE ON FUNCTION public.backend_update_holder_count TO anon;