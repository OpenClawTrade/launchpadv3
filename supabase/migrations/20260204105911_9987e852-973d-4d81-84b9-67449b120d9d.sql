-- TUNA Trading Agents - Phase 1: Database Schema

-- 1. Create trading_agents table
CREATE TABLE public.trading_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  fun_token_id UUID REFERENCES public.fun_tokens(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL UNIQUE,
  description TEXT,
  avatar_url TEXT,
  
  -- Trading wallet (auto-generated on creation)
  wallet_address TEXT NOT NULL UNIQUE,
  wallet_private_key_encrypted TEXT NOT NULL,
  
  -- Trading Stats
  trading_capital_sol NUMERIC DEFAULT 0,
  total_invested_sol NUMERIC DEFAULT 0,
  total_profit_sol NUMERIC DEFAULT 0,
  unrealized_pnl_sol NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  
  -- Strategy Configuration
  strategy_type TEXT DEFAULT 'balanced' CHECK (strategy_type IN ('conservative', 'balanced', 'aggressive')),
  stop_loss_pct NUMERIC DEFAULT 20,
  take_profit_pct NUMERIC DEFAULT 50,
  max_position_size_sol NUMERIC DEFAULT 0.2,
  max_concurrent_positions INTEGER DEFAULT 3,
  preferred_narratives TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'depleted')),
  last_trade_at TIMESTAMPTZ,
  last_deposit_at TIMESTAMPTZ,
  
  -- Creator link (optional)
  creator_wallet TEXT,
  creator_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create trading_agent_positions table
CREATE TABLE public.trading_agent_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_agent_id UUID NOT NULL REFERENCES public.trading_agents(id) ON DELETE CASCADE,
  
  -- Token Info
  token_address TEXT NOT NULL,
  token_name TEXT,
  token_symbol TEXT,
  token_image_url TEXT,
  
  -- Position Details
  entry_price_sol NUMERIC NOT NULL,
  current_price_sol NUMERIC,
  amount_tokens NUMERIC NOT NULL,
  investment_sol NUMERIC NOT NULL,
  current_value_sol NUMERIC,
  
  -- P&L
  unrealized_pnl_sol NUMERIC DEFAULT 0,
  unrealized_pnl_pct NUMERIC DEFAULT 0,
  realized_pnl_sol NUMERIC,
  
  -- Reasoning
  entry_reason TEXT,
  entry_narrative TEXT,
  exit_reason TEXT,
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped_out', 'take_profit')),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- 3. Create trading_agent_trades table
CREATE TABLE public.trading_agent_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_agent_id UUID NOT NULL REFERENCES public.trading_agents(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.trading_agent_positions(id) ON DELETE SET NULL,
  
  -- Trade Details
  token_address TEXT NOT NULL,
  token_name TEXT,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount_sol NUMERIC NOT NULL,
  amount_tokens NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  
  -- Execution
  signature TEXT,
  slippage_actual NUMERIC,
  execution_time_ms INTEGER,
  
  -- Strategy Context
  strategy_used TEXT,
  narrative_match TEXT,
  token_score NUMERIC,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create trading_agent_fee_deposits table
CREATE TABLE public.trading_agent_fee_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_agent_id UUID NOT NULL REFERENCES public.trading_agents(id) ON DELETE CASCADE,
  amount_sol NUMERIC NOT NULL,
  source TEXT DEFAULT 'fee_distribution' CHECK (source IN ('fee_distribution', 'manual')),
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create pumpfun_trending_tokens table
CREATE TABLE public.pumpfun_trending_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address TEXT NOT NULL UNIQUE,
  name TEXT,
  symbol TEXT,
  image_url TEXT,
  market_cap_sol NUMERIC,
  virtual_sol_reserves NUMERIC,
  holder_count INTEGER,
  is_king_of_hill BOOLEAN DEFAULT false,
  created_timestamp BIGINT,
  token_score NUMERIC DEFAULT 0,
  narrative_match TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Add trading_agent_id to fun_tokens
ALTER TABLE public.fun_tokens 
ADD COLUMN IF NOT EXISTS trading_agent_id UUID REFERENCES public.trading_agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_trading_agent_token BOOLEAN DEFAULT false;

-- 7. Add trading_agent_id to agents
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS trading_agent_id UUID REFERENCES public.trading_agents(id) ON DELETE SET NULL;

-- 8. Create indexes for performance
CREATE INDEX idx_trading_agents_status ON public.trading_agents(status);
CREATE INDEX idx_trading_agents_wallet ON public.trading_agents(wallet_address);
CREATE INDEX idx_trading_agents_fun_token ON public.trading_agents(fun_token_id);
CREATE INDEX idx_trading_positions_agent_status ON public.trading_agent_positions(trading_agent_id, status);
CREATE INDEX idx_trading_positions_open ON public.trading_agent_positions(trading_agent_id) WHERE status = 'open';
CREATE INDEX idx_trading_trades_agent ON public.trading_agent_trades(trading_agent_id, created_at DESC);
CREATE INDEX idx_trading_trades_position ON public.trading_agent_trades(position_id);
CREATE INDEX idx_trading_fee_deposits_agent ON public.trading_agent_fee_deposits(trading_agent_id, created_at DESC);
CREATE INDEX idx_pumpfun_trending_score ON public.pumpfun_trending_tokens(token_score DESC);
CREATE INDEX idx_pumpfun_trending_synced ON public.pumpfun_trending_tokens(last_synced_at);
CREATE INDEX idx_fun_tokens_trading_agent ON public.fun_tokens(trading_agent_id) WHERE trading_agent_id IS NOT NULL;

-- 9. Enable RLS on all new tables
ALTER TABLE public.trading_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_agent_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_agent_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_agent_fee_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pumpfun_trending_tokens ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies - Public read access for all trading data (transparency)
CREATE POLICY "Trading agents are publicly readable"
  ON public.trading_agents FOR SELECT
  USING (true);

CREATE POLICY "Trading positions are publicly readable"
  ON public.trading_agent_positions FOR SELECT
  USING (true);

CREATE POLICY "Trading trades are publicly readable"
  ON public.trading_agent_trades FOR SELECT
  USING (true);

CREATE POLICY "Trading fee deposits are publicly readable"
  ON public.trading_agent_fee_deposits FOR SELECT
  USING (true);

CREATE POLICY "Pumpfun trending tokens are publicly readable"
  ON public.pumpfun_trending_tokens FOR SELECT
  USING (true);

-- 11. Service role policies for backend operations
CREATE POLICY "Service role can manage trading agents"
  ON public.trading_agents FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage trading positions"
  ON public.trading_agent_positions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage trading trades"
  ON public.trading_agent_trades FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage trading fee deposits"
  ON public.trading_agent_fee_deposits FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage pumpfun trending"
  ON public.pumpfun_trending_tokens FOR ALL
  USING (true)
  WITH CHECK (true);

-- 12. Update timestamp trigger for trading_agents
CREATE OR REPLACE FUNCTION public.update_trading_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trading_agents_updated_at
  BEFORE UPDATE ON public.trading_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trading_agents_updated_at();

-- 13. Backend function to create trading agent
CREATE OR REPLACE FUNCTION public.backend_create_trading_agent(
  p_name TEXT,
  p_ticker TEXT,
  p_description TEXT,
  p_avatar_url TEXT,
  p_wallet_address TEXT,
  p_wallet_private_key_encrypted TEXT,
  p_strategy_type TEXT DEFAULT 'balanced',
  p_creator_wallet TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.trading_agents (
    name, ticker, description, avatar_url,
    wallet_address, wallet_private_key_encrypted,
    strategy_type, creator_wallet, status
  ) VALUES (
    p_name, p_ticker, p_description, p_avatar_url,
    p_wallet_address, p_wallet_private_key_encrypted,
    p_strategy_type, p_creator_wallet, 'pending'
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 14. Backend function to link trading agent to token
CREATE OR REPLACE FUNCTION public.backend_link_trading_agent_token(
  p_trading_agent_id UUID,
  p_fun_token_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update trading agent with token reference
  UPDATE public.trading_agents
  SET fun_token_id = p_fun_token_id, status = 'active'
  WHERE id = p_trading_agent_id;
  
  -- Update fun_token with trading agent reference
  UPDATE public.fun_tokens
  SET trading_agent_id = p_trading_agent_id, is_trading_agent_token = true
  WHERE id = p_fun_token_id;
END;
$$;

-- 15. Backend function to record fee deposit
CREATE OR REPLACE FUNCTION public.backend_record_trading_agent_deposit(
  p_trading_agent_id UUID,
  p_amount_sol NUMERIC,
  p_source TEXT DEFAULT 'fee_distribution',
  p_signature TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Record the deposit
  INSERT INTO public.trading_agent_fee_deposits (
    trading_agent_id, amount_sol, source, signature
  ) VALUES (
    p_trading_agent_id, p_amount_sol, p_source, p_signature
  )
  RETURNING id INTO v_id;
  
  -- Update trading agent capital
  UPDATE public.trading_agents
  SET 
    trading_capital_sol = trading_capital_sol + p_amount_sol,
    last_deposit_at = now()
  WHERE id = p_trading_agent_id;
  
  RETURN v_id;
END;
$$;

-- 16. Backend function to open position
CREATE OR REPLACE FUNCTION public.backend_open_trading_position(
  p_trading_agent_id UUID,
  p_token_address TEXT,
  p_token_name TEXT,
  p_token_symbol TEXT,
  p_token_image_url TEXT,
  p_entry_price_sol NUMERIC,
  p_amount_tokens NUMERIC,
  p_investment_sol NUMERIC,
  p_entry_reason TEXT,
  p_entry_narrative TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.trading_agent_positions (
    trading_agent_id, token_address, token_name, token_symbol, token_image_url,
    entry_price_sol, amount_tokens, investment_sol, current_price_sol, current_value_sol,
    entry_reason, entry_narrative, status
  ) VALUES (
    p_trading_agent_id, p_token_address, p_token_name, p_token_symbol, p_token_image_url,
    p_entry_price_sol, p_amount_tokens, p_investment_sol, p_entry_price_sol, p_investment_sol,
    p_entry_reason, p_entry_narrative, 'open'
  )
  RETURNING id INTO v_id;
  
  -- Update trading agent stats
  UPDATE public.trading_agents
  SET 
    trading_capital_sol = trading_capital_sol - p_investment_sol,
    total_invested_sol = total_invested_sol + p_investment_sol,
    last_trade_at = now()
  WHERE id = p_trading_agent_id;
  
  RETURN v_id;
END;
$$;

-- 17. Backend function to close position
CREATE OR REPLACE FUNCTION public.backend_close_trading_position(
  p_position_id UUID,
  p_exit_price_sol NUMERIC,
  p_exit_reason TEXT,
  p_status TEXT DEFAULT 'closed'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trading_agent_id UUID;
  v_investment_sol NUMERIC;
  v_amount_tokens NUMERIC;
  v_current_value NUMERIC;
  v_realized_pnl NUMERIC;
  v_is_win BOOLEAN;
BEGIN
  -- Get position details
  SELECT trading_agent_id, investment_sol, amount_tokens
  INTO v_trading_agent_id, v_investment_sol, v_amount_tokens
  FROM public.trading_agent_positions
  WHERE id = p_position_id;
  
  -- Calculate final value and P&L
  v_current_value := v_amount_tokens * p_exit_price_sol;
  v_realized_pnl := v_current_value - v_investment_sol;
  v_is_win := v_realized_pnl > 0;
  
  -- Update position
  UPDATE public.trading_agent_positions
  SET 
    current_price_sol = p_exit_price_sol,
    current_value_sol = v_current_value,
    realized_pnl_sol = v_realized_pnl,
    unrealized_pnl_sol = 0,
    unrealized_pnl_pct = 0,
    exit_reason = p_exit_reason,
    status = p_status,
    closed_at = now()
  WHERE id = p_position_id;
  
  -- Update trading agent stats
  UPDATE public.trading_agents
  SET 
    trading_capital_sol = trading_capital_sol + v_current_value,
    total_profit_sol = total_profit_sol + v_realized_pnl,
    total_trades = total_trades + 1,
    winning_trades = winning_trades + CASE WHEN v_is_win THEN 1 ELSE 0 END,
    losing_trades = losing_trades + CASE WHEN NOT v_is_win THEN 1 ELSE 0 END,
    win_rate = CASE 
      WHEN total_trades + 1 > 0 
      THEN ((winning_trades + CASE WHEN v_is_win THEN 1 ELSE 0 END)::NUMERIC / (total_trades + 1)::NUMERIC) * 100 
      ELSE 0 
    END,
    last_trade_at = now()
  WHERE id = v_trading_agent_id;
END;
$$;

-- 18. Backend function to record trade
CREATE OR REPLACE FUNCTION public.backend_record_trading_agent_trade(
  p_trading_agent_id UUID,
  p_position_id UUID,
  p_token_address TEXT,
  p_token_name TEXT,
  p_trade_type TEXT,
  p_amount_sol NUMERIC,
  p_amount_tokens NUMERIC,
  p_price_per_token NUMERIC,
  p_signature TEXT DEFAULT NULL,
  p_slippage_actual NUMERIC DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_strategy_used TEXT DEFAULT NULL,
  p_narrative_match TEXT DEFAULT NULL,
  p_token_score NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.trading_agent_trades (
    trading_agent_id, position_id, token_address, token_name, trade_type,
    amount_sol, amount_tokens, price_per_token, signature, slippage_actual,
    execution_time_ms, strategy_used, narrative_match, token_score, status, error_message
  ) VALUES (
    p_trading_agent_id, p_position_id, p_token_address, p_token_name, p_trade_type,
    p_amount_sol, p_amount_tokens, p_price_per_token, p_signature, p_slippage_actual,
    p_execution_time_ms, p_strategy_used, p_narrative_match, p_token_score, p_status, p_error_message
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 19. Backend function to upsert pumpfun trending token
CREATE OR REPLACE FUNCTION public.backend_upsert_pumpfun_trending(
  p_mint_address TEXT,
  p_name TEXT,
  p_symbol TEXT,
  p_image_url TEXT,
  p_market_cap_sol NUMERIC,
  p_virtual_sol_reserves NUMERIC,
  p_holder_count INTEGER,
  p_is_king_of_hill BOOLEAN,
  p_created_timestamp BIGINT,
  p_token_score NUMERIC,
  p_narrative_match TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pumpfun_trending_tokens (
    mint_address, name, symbol, image_url, market_cap_sol,
    virtual_sol_reserves, holder_count, is_king_of_hill,
    created_timestamp, token_score, narrative_match, last_synced_at
  ) VALUES (
    p_mint_address, p_name, p_symbol, p_image_url, p_market_cap_sol,
    p_virtual_sol_reserves, p_holder_count, p_is_king_of_hill,
    p_created_timestamp, p_token_score, p_narrative_match, now()
  )
  ON CONFLICT (mint_address) DO UPDATE SET
    name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    image_url = EXCLUDED.image_url,
    market_cap_sol = EXCLUDED.market_cap_sol,
    virtual_sol_reserves = EXCLUDED.virtual_sol_reserves,
    holder_count = EXCLUDED.holder_count,
    is_king_of_hill = EXCLUDED.is_king_of_hill,
    token_score = EXCLUDED.token_score,
    narrative_match = EXCLUDED.narrative_match,
    last_synced_at = now();
END;
$$;

-- 20. Get trading agents leaderboard
CREATE OR REPLACE FUNCTION public.get_trading_agents_leaderboard(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  ticker TEXT,
  avatar_url TEXT,
  trading_capital_sol NUMERIC,
  total_profit_sol NUMERIC,
  unrealized_pnl_sol NUMERIC,
  win_rate NUMERIC,
  total_trades INTEGER,
  strategy_type TEXT,
  status TEXT,
  fun_token_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 
    ta.id,
    ta.name,
    ta.ticker,
    ta.avatar_url,
    ta.trading_capital_sol,
    ta.total_profit_sol,
    ta.unrealized_pnl_sol,
    ta.win_rate,
    ta.total_trades,
    ta.strategy_type,
    ta.status,
    ta.fun_token_id,
    ta.created_at
  FROM public.trading_agents ta
  WHERE ta.status IN ('active', 'paused')
  ORDER BY ta.total_profit_sol DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;