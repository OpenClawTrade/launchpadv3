-- =====================================================
-- TRENCHES Advanced Trading Features
-- Limit Orders, Stop-Loss, DCA, Copy Trading
-- =====================================================

-- 1. LIMIT ORDERS TABLE
CREATE TABLE public.limit_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('limit', 'stop_loss', 'take_profit')),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  trigger_price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  amount_type TEXT NOT NULL DEFAULT 'sol' CHECK (amount_type IN ('sol', 'token', 'percent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'expired')),
  slippage_bps INTEGER DEFAULT 500,
  expires_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  executed_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for order monitoring
CREATE INDEX idx_limit_orders_pending ON public.limit_orders(status, token_id) WHERE status = 'pending';
CREATE INDEX idx_limit_orders_user ON public.limit_orders(user_wallet, status);

-- Enable RLS
ALTER TABLE public.limit_orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own orders"
  ON public.limit_orders FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own orders"
  ON public.limit_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own orders"
  ON public.limit_orders FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own orders"
  ON public.limit_orders FOR DELETE
  USING (true);

-- 2. DCA (Dollar Cost Average) ORDERS TABLE
CREATE TABLE public.dca_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  amount_per_order NUMERIC NOT NULL,
  total_orders INTEGER NOT NULL,
  orders_executed INTEGER NOT NULL DEFAULT 0,
  interval_seconds INTEGER NOT NULL,
  next_execution_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  slippage_bps INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for DCA execution
CREATE INDEX idx_dca_orders_active ON public.dca_orders(status, next_execution_at) WHERE status = 'active';
CREATE INDEX idx_dca_orders_user ON public.dca_orders(user_wallet, status);

-- Enable RLS
ALTER TABLE public.dca_orders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own DCA orders"
  ON public.dca_orders FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own DCA orders"
  ON public.dca_orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own DCA orders"
  ON public.dca_orders FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own DCA orders"
  ON public.dca_orders FOR DELETE
  USING (true);

-- 3. TRACKED WALLETS (Copy Trading)
CREATE TABLE public.tracked_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_label TEXT,
  is_copy_trading_enabled BOOLEAN NOT NULL DEFAULT false,
  copy_amount_sol NUMERIC,
  copy_percentage NUMERIC,
  max_per_trade_sol NUMERIC DEFAULT 1,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  total_pnl_sol NUMERIC DEFAULT 0,
  trades_copied INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_profile_id, wallet_address)
);

-- Index for tracked wallets
CREATE INDEX idx_tracked_wallets_user ON public.tracked_wallets(user_profile_id);
CREATE INDEX idx_tracked_wallets_address ON public.tracked_wallets(wallet_address);

-- Enable RLS
ALTER TABLE public.tracked_wallets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tracked wallets"
  ON public.tracked_wallets FOR SELECT
  USING (true);

CREATE POLICY "Users can create tracked wallets"
  ON public.tracked_wallets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their tracked wallets"
  ON public.tracked_wallets FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their tracked wallets"
  ON public.tracked_wallets FOR DELETE
  USING (true);

-- 4. WALLET TRADES (Logged trades from tracked wallets)
CREATE TABLE public.wallet_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_wallet_id UUID REFERENCES public.tracked_wallets(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  token_name TEXT,
  token_ticker TEXT,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  sol_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  signature TEXT NOT NULL UNIQUE,
  slot BIGINT,
  copied_by_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for wallet trades
CREATE INDEX idx_wallet_trades_wallet ON public.wallet_trades(wallet_address);
CREATE INDEX idx_wallet_trades_token ON public.wallet_trades(token_mint);
CREATE INDEX idx_wallet_trades_recent ON public.wallet_trades(created_at DESC);

-- Enable RLS
ALTER TABLE public.wallet_trades ENABLE ROW LEVEL SECURITY;

-- Policies (public read for discovery)
CREATE POLICY "Anyone can view wallet trades"
  ON public.wallet_trades FOR SELECT
  USING (true);

-- 5. COPY TRADE EXECUTIONS
CREATE TABLE public.copy_trade_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_wallet_id UUID NOT NULL REFERENCES public.tracked_wallets(id) ON DELETE CASCADE,
  wallet_trade_id UUID NOT NULL REFERENCES public.wallet_trades(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  sol_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Index for copy executions
CREATE INDEX idx_copy_executions_user ON public.copy_trade_executions(user_profile_id);
CREATE INDEX idx_copy_executions_status ON public.copy_trade_executions(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.copy_trade_executions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own copy executions"
  ON public.copy_trade_executions FOR SELECT
  USING (true);

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.limit_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dca_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_trades;