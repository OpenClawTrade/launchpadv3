-- Trigger function: auto-sync launchpad_transactions → alpha_trades
CREATE OR REPLACE FUNCTION public.sync_alpha_trade_from_launchpad_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token_name text;
  v_token_ticker text;
  v_token_mint text;
  v_trader_name text;
  v_trader_avatar text;
BEGIN
  -- Get token info
  SELECT mint_address, name, ticker INTO v_token_mint, v_token_name, v_token_ticker
  FROM public.tokens WHERE id = NEW.token_id;

  -- If token not found, skip
  IF v_token_mint IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get trader profile info if available
  IF NEW.user_profile_id IS NOT NULL THEN
    SELECT display_name, avatar_url INTO v_trader_name, v_trader_avatar
    FROM public.profiles WHERE id = NEW.user_profile_id;
  END IF;

  -- Upsert into alpha_trades (dedupe on tx_hash = signature)
  INSERT INTO public.alpha_trades (
    wallet_address, token_mint, token_name, token_ticker,
    trade_type, amount_sol, amount_tokens, price_sol,
    tx_hash, chain, trader_display_name, trader_avatar_url
  ) VALUES (
    NEW.user_wallet,
    v_token_mint,
    v_token_name,
    v_token_ticker,
    NEW.transaction_type,
    COALESCE(NEW.sol_amount, 0),
    COALESCE(NEW.token_amount, 0),
    NEW.price_per_token,
    NEW.signature,
    'solana',
    v_trader_name,
    v_trader_avatar
  )
  ON CONFLICT (tx_hash) DO UPDATE SET
    token_name = EXCLUDED.token_name,
    token_ticker = EXCLUDED.token_ticker,
    trader_display_name = EXCLUDED.trader_display_name,
    trader_avatar_url = EXCLUDED.trader_avatar_url;

  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS sync_alpha_trade_trigger ON public.launchpad_transactions;
CREATE TRIGGER sync_alpha_trade_trigger
  AFTER INSERT ON public.launchpad_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_alpha_trade_from_launchpad_tx();