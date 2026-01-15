-- Create table for tracking sniper trades
CREATE TABLE public.sniper_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES public.tokens(id),
  fun_token_id UUID REFERENCES public.fun_tokens(id),
  mint_address TEXT NOT NULL,
  pool_address TEXT NOT NULL,
  buy_amount_sol NUMERIC NOT NULL DEFAULT 0.5,
  buy_signature TEXT,
  buy_slot INTEGER,
  tokens_received NUMERIC,
  sell_signature TEXT,
  sell_slot INTEGER,
  sol_received NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bought_at TIMESTAMP WITH TIME ZONE,
  sold_at TIMESTAMP WITH TIME ZONE,
  scheduled_sell_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.sniper_trades ENABLE ROW LEVEL SECURITY;

-- Create policy for backend access (service role only)
CREATE POLICY "Service role full access" ON public.sniper_trades
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for status queries
CREATE INDEX idx_sniper_trades_status ON public.sniper_trades(status);
CREATE INDEX idx_sniper_trades_scheduled_sell ON public.sniper_trades(scheduled_sell_at) WHERE status = 'bought';

-- Create backend function to insert sniper trade
CREATE OR REPLACE FUNCTION public.backend_create_sniper_trade(
  p_token_id UUID DEFAULT NULL,
  p_fun_token_id UUID DEFAULT NULL,
  p_mint_address TEXT DEFAULT NULL,
  p_pool_address TEXT DEFAULT NULL,
  p_buy_amount_sol NUMERIC DEFAULT 0.5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.sniper_trades (
    token_id, fun_token_id, mint_address, pool_address, buy_amount_sol, status
  ) VALUES (
    p_token_id, p_fun_token_id, p_mint_address, p_pool_address, p_buy_amount_sol, 'pending'
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Create backend function to update sniper trade after buy
CREATE OR REPLACE FUNCTION public.backend_update_sniper_buy(
  p_id UUID,
  p_buy_signature TEXT,
  p_buy_slot INTEGER DEFAULT NULL,
  p_tokens_received NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sniper_trades SET
    buy_signature = p_buy_signature,
    buy_slot = p_buy_slot,
    tokens_received = p_tokens_received,
    status = 'bought',
    bought_at = now(),
    scheduled_sell_at = now() + interval '5 seconds'
  WHERE id = p_id;
END;
$$;

-- Create backend function to update sniper trade after sell
CREATE OR REPLACE FUNCTION public.backend_update_sniper_sell(
  p_id UUID,
  p_sell_signature TEXT,
  p_sell_slot INTEGER DEFAULT NULL,
  p_sol_received NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sniper_trades SET
    sell_signature = p_sell_signature,
    sell_slot = p_sell_slot,
    sol_received = p_sol_received,
    status = 'sold',
    sold_at = now()
  WHERE id = p_id;
END;
$$;

-- Create backend function to mark sniper trade as failed
CREATE OR REPLACE FUNCTION public.backend_fail_sniper_trade(
  p_id UUID,
  p_error_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sniper_trades SET
    status = 'failed',
    error_message = p_error_message
  WHERE id = p_id;
END;
$$;