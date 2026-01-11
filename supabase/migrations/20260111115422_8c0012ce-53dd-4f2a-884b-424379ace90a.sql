-- Create backend function for creating tokens (bypasses RLS)
CREATE OR REPLACE FUNCTION public.backend_create_token(
  p_id UUID,
  p_mint_address TEXT,
  p_name TEXT,
  p_ticker TEXT,
  p_creator_wallet TEXT,
  p_creator_id UUID DEFAULT NULL,
  p_dbc_pool_address TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_website_url TEXT DEFAULT NULL,
  p_twitter_url TEXT DEFAULT NULL,
  p_telegram_url TEXT DEFAULT NULL,
  p_discord_url TEXT DEFAULT NULL,
  p_virtual_sol_reserves NUMERIC DEFAULT 30,
  p_virtual_token_reserves NUMERIC DEFAULT 1000000000,
  p_real_sol_reserves NUMERIC DEFAULT 0,
  p_real_token_reserves NUMERIC DEFAULT 800000000,
  p_total_supply NUMERIC DEFAULT 1000000000,
  p_price_sol NUMERIC DEFAULT 0.00000003,
  p_market_cap_sol NUMERIC DEFAULT 30,
  p_graduation_threshold_sol NUMERIC DEFAULT 85,
  p_system_fee_bps INTEGER DEFAULT 100,
  p_creator_fee_bps INTEGER DEFAULT 100
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tokens (
    id, mint_address, name, ticker, creator_wallet, creator_id,
    dbc_pool_address, description, image_url, website_url, twitter_url,
    telegram_url, discord_url, virtual_sol_reserves, virtual_token_reserves,
    real_sol_reserves, real_token_reserves, total_supply, price_sol,
    market_cap_sol, graduation_threshold_sol, system_fee_bps, creator_fee_bps,
    status, bonding_curve_progress, holder_count
  ) VALUES (
    p_id, p_mint_address, p_name, p_ticker, p_creator_wallet, p_creator_id,
    p_dbc_pool_address, p_description, p_image_url, p_website_url, p_twitter_url,
    p_telegram_url, p_discord_url, p_virtual_sol_reserves, p_virtual_token_reserves,
    p_real_sol_reserves, p_real_token_reserves, p_total_supply, p_price_sol,
    p_market_cap_sol, p_graduation_threshold_sol, p_system_fee_bps, p_creator_fee_bps,
    'bonding', 0, 0
  );
  
  RETURN p_id;
END;
$$;

-- Create backend function for creating fee earners
CREATE OR REPLACE FUNCTION public.backend_create_fee_earner(
  p_token_id UUID,
  p_earner_type TEXT,
  p_share_bps INTEGER,
  p_wallet_address TEXT DEFAULT NULL,
  p_profile_id UUID DEFAULT NULL,
  p_twitter_handle TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.fee_earners (
    token_id, earner_type, share_bps, wallet_address, profile_id, twitter_handle,
    unclaimed_sol, total_earned_sol
  ) VALUES (
    p_token_id, p_earner_type, p_share_bps, p_wallet_address, p_profile_id, p_twitter_handle,
    0, 0
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute permissions to anon role
GRANT EXECUTE ON FUNCTION public.backend_create_token TO anon;
GRANT EXECUTE ON FUNCTION public.backend_create_fee_earner TO anon;