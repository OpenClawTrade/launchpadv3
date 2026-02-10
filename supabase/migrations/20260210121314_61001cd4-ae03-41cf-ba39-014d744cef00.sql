
-- =============================================
-- CLAW MODE: Full Database Separation (15 tables)
-- =============================================

-- 1. claw_agents (mirrors agents)
CREATE TABLE public.claw_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  twitter_handle TEXT,
  karma INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  post_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  total_tokens_launched INTEGER DEFAULT 0,
  total_fees_earned_sol NUMERIC DEFAULT 0,
  total_fees_claimed_sol NUMERIC DEFAULT 0,
  launches_today INTEGER DEFAULT 0,
  has_posted_welcome BOOLEAN DEFAULT false,
  writing_style JSONB,
  style_source_username TEXT,
  style_source_twitter_url TEXT,
  style_learned_at TIMESTAMPTZ,
  last_launch_at TIMESTAMPTZ,
  last_social_activity_at TIMESTAMPTZ,
  last_auto_engage_at TIMESTAMPTZ,
  last_cross_visit_at TIMESTAMPTZ,
  trading_agent_id UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_agents_public_read" ON public.claw_agents FOR SELECT USING (true);

-- 2. claw_tokens (mirrors fun_tokens)
CREATE TABLE public.claw_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  mint_address TEXT,
  creator_wallet TEXT,
  deployer_wallet TEXT,
  dbc_pool_address TEXT,
  market_cap_sol NUMERIC DEFAULT 0,
  price_sol NUMERIC DEFAULT 0,
  price_24h_ago NUMERIC,
  price_change_24h NUMERIC DEFAULT 0,
  volume_24h_sol NUMERIC DEFAULT 0,
  holder_count INTEGER DEFAULT 0,
  bonding_progress NUMERIC DEFAULT 0,
  total_fees_earned NUMERIC DEFAULT 0,
  total_fees_claimed NUMERIC DEFAULT 0,
  trading_fee_bps INTEGER DEFAULT 200,
  creator_fee_bps INTEGER DEFAULT 8000,
  agent_fee_share_bps INTEGER,
  fee_mode TEXT DEFAULT 'standard',
  launchpad_type TEXT DEFAULT 'claw',
  status TEXT DEFAULT 'active',
  chain TEXT DEFAULT 'solana',
  twitter_url TEXT,
  website_url TEXT,
  telegram_url TEXT,
  discord_url TEXT,
  agent_id UUID REFERENCES public.claw_agents(id),
  trading_agent_id UUID,
  is_trading_agent_token BOOLEAN DEFAULT false,
  last_distribution_at TIMESTAMPTZ,
  starting_mcap_usd NUMERIC,
  fair_launch_duration_mins INTEGER,
  fair_launch_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_tokens_public_read" ON public.claw_tokens FOR SELECT USING (true);

-- 3. claw_agent_tokens (mirrors agent_tokens)
CREATE TABLE public.claw_agent_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.claw_agents(id),
  fun_token_id UUID NOT NULL REFERENCES public.claw_tokens(id),
  source_platform TEXT,
  source_post_id TEXT,
  source_post_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_agent_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_agent_tokens_public_read" ON public.claw_agent_tokens FOR SELECT USING (true);

-- 4. claw_fee_claims (mirrors fun_fee_claims)
CREATE TABLE public.claw_fee_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fun_token_id UUID REFERENCES public.claw_tokens(id),
  pool_address TEXT NOT NULL,
  claimed_sol NUMERIC DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMPTZ,
  creator_distributed BOOLEAN DEFAULT false,
  creator_distribution_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_fee_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_fee_claims_public_read" ON public.claw_fee_claims FOR SELECT USING (true);

-- 5. claw_agent_fee_distributions (mirrors agent_fee_distributions)
CREATE TABLE public.claw_agent_fee_distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.claw_agents(id),
  fun_token_id UUID NOT NULL REFERENCES public.claw_tokens(id),
  amount_sol NUMERIC NOT NULL,
  signature TEXT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_agent_fee_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_agent_fee_distributions_public_read" ON public.claw_agent_fee_distributions FOR SELECT USING (true);

-- 6. claw_trading_agents (mirrors trading_agents)
CREATE TABLE public.claw_trading_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  wallet_address TEXT NOT NULL,
  wallet_private_key_encrypted TEXT NOT NULL,
  trading_capital_sol NUMERIC DEFAULT 0,
  total_invested_sol NUMERIC DEFAULT 0,
  total_profit_sol NUMERIC DEFAULT 0,
  unrealized_pnl_sol NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  strategy_type TEXT DEFAULT 'balanced',
  stop_loss_pct NUMERIC DEFAULT 20,
  take_profit_pct NUMERIC DEFAULT 50,
  max_concurrent_positions INTEGER DEFAULT 3,
  max_position_size_sol NUMERIC,
  consecutive_wins INTEGER DEFAULT 0,
  consecutive_losses INTEGER DEFAULT 0,
  best_trade_sol NUMERIC DEFAULT 0,
  worst_trade_sol NUMERIC DEFAULT 0,
  avg_hold_time_minutes NUMERIC DEFAULT 0,
  preferred_narratives TEXT[],
  avoided_patterns TEXT[],
  learned_patterns JSONB,
  trading_style TEXT,
  strategy_notes TEXT,
  status TEXT DEFAULT 'pending',
  agent_id UUID REFERENCES public.claw_agents(id),
  fun_token_id UUID REFERENCES public.claw_tokens(id),
  creator_profile_id UUID,
  creator_wallet TEXT,
  mint_address TEXT,
  twitter_url TEXT,
  last_trade_at TIMESTAMPTZ,
  last_deposit_at TIMESTAMPTZ,
  last_strategy_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_trading_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_trading_agents_public_read" ON public.claw_trading_agents FOR SELECT USING (true);

-- Add FK from claw_tokens to claw_trading_agents
ALTER TABLE public.claw_tokens ADD CONSTRAINT claw_tokens_trading_agent_id_fkey FOREIGN KEY (trading_agent_id) REFERENCES public.claw_trading_agents(id);
-- Add FK from claw_agents to claw_trading_agents
ALTER TABLE public.claw_agents ADD CONSTRAINT claw_agents_trading_agent_id_fkey FOREIGN KEY (trading_agent_id) REFERENCES public.claw_trading_agents(id);

-- 7. claw_trading_positions (mirrors trading_agent_positions)
CREATE TABLE public.claw_trading_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trading_agent_id UUID NOT NULL REFERENCES public.claw_trading_agents(id),
  token_address TEXT NOT NULL,
  token_name TEXT,
  token_symbol TEXT,
  token_image_url TEXT,
  entry_price_sol NUMERIC NOT NULL,
  current_price_sol NUMERIC,
  amount_tokens NUMERIC NOT NULL,
  investment_sol NUMERIC NOT NULL,
  current_value_sol NUMERIC,
  unrealized_pnl_sol NUMERIC DEFAULT 0,
  unrealized_pnl_pct NUMERIC DEFAULT 0,
  realized_pnl_sol NUMERIC,
  entry_reason TEXT,
  entry_narrative TEXT,
  exit_reason TEXT,
  target_price_sol NUMERIC,
  stop_loss_price_sol NUMERIC,
  risk_assessment TEXT,
  market_conditions TEXT,
  strategy_adjustments TEXT,
  trailing_stop_active BOOLEAN DEFAULT false,
  limit_order_tp_pubkey TEXT,
  limit_order_tp_status TEXT,
  limit_order_sl_pubkey TEXT,
  limit_order_sl_status TEXT,
  status TEXT DEFAULT 'open',
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);
ALTER TABLE public.claw_trading_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_trading_positions_public_read" ON public.claw_trading_positions FOR SELECT USING (true);

-- 8. claw_trading_trades (mirrors trading_agent_trades)
CREATE TABLE public.claw_trading_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trading_agent_id UUID NOT NULL REFERENCES public.claw_trading_agents(id),
  position_id UUID REFERENCES public.claw_trading_positions(id),
  token_address TEXT NOT NULL,
  token_name TEXT,
  trade_type TEXT NOT NULL,
  amount_sol NUMERIC NOT NULL,
  amount_tokens NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  signature TEXT,
  buy_signature TEXT,
  verified_pnl_sol NUMERIC,
  verified_at TIMESTAMPTZ,
  strategy_used TEXT,
  narrative_match TEXT,
  token_score NUMERIC,
  entry_analysis TEXT,
  exit_analysis TEXT,
  ai_reasoning TEXT,
  market_context TEXT,
  lessons_learned TEXT,
  confidence_score NUMERIC DEFAULT 0,
  slippage_actual NUMERIC,
  execution_time_ms INTEGER,
  error_message TEXT,
  status TEXT DEFAULT 'pending',
  subtuna_post_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_trading_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_trading_trades_public_read" ON public.claw_trading_trades FOR SELECT USING (true);

-- 9. claw_trading_fee_deposits (mirrors trading_agent_fee_deposits)
CREATE TABLE public.claw_trading_fee_deposits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trading_agent_id UUID NOT NULL REFERENCES public.claw_trading_agents(id),
  amount_sol NUMERIC NOT NULL,
  source TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_trading_fee_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_trading_fee_deposits_public_read" ON public.claw_trading_fee_deposits FOR SELECT USING (true);

-- 10. claw_trading_strategy_reviews (mirrors trading_agent_strategy_reviews)
CREATE TABLE public.claw_trading_strategy_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trading_agent_id UUID NOT NULL REFERENCES public.claw_trading_agents(id),
  review_type TEXT DEFAULT 'periodic',
  trades_analyzed INTEGER,
  win_rate_at_review NUMERIC,
  total_pnl_at_review NUMERIC,
  key_insights TEXT,
  strategy_adjustments TEXT,
  new_rules TEXT[],
  deprecated_rules TEXT[],
  confidence_level NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_trading_strategy_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_trading_strategy_reviews_public_read" ON public.claw_trading_strategy_reviews FOR SELECT USING (true);

-- 11. claw_communities (mirrors subtuna)
CREATE TABLE public.claw_communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  agent_id UUID REFERENCES public.claw_agents(id),
  fun_token_id UUID REFERENCES public.claw_tokens(id) UNIQUE,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  rules JSONB,
  settings JSONB,
  style_source_username TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_communities_public_read" ON public.claw_communities FOR SELECT USING (true);

-- 12. claw_posts (mirrors subtuna_posts)
CREATE TABLE public.claw_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtuna_id UUID NOT NULL REFERENCES public.claw_communities(id),
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  link_url TEXT,
  post_type TEXT DEFAULT 'text',
  slug TEXT,
  author_id UUID,
  author_agent_id UUID REFERENCES public.claw_agents(id),
  is_agent_post BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  guest_upvotes INTEGER DEFAULT 0,
  guest_downvotes INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  x_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_posts_public_read" ON public.claw_posts FOR SELECT USING (true);

-- 13. claw_comments (mirrors subtuna_comments)
CREATE TABLE public.claw_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.claw_posts(id),
  author_id UUID,
  author_agent_id UUID REFERENCES public.claw_agents(id),
  parent_comment_id UUID REFERENCES public.claw_comments(id),
  content TEXT NOT NULL,
  is_agent_comment BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_comments_public_read" ON public.claw_comments FOR SELECT USING (true);

-- 14. claw_votes (mirrors subtuna_votes)
CREATE TABLE public.claw_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.claw_posts(id),
  user_id UUID NOT NULL,
  vote_type INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_votes_public_read" ON public.claw_votes FOR SELECT USING (true);

-- 15. claw_deployer_wallets (mirrors deployer_wallets)
CREATE TABLE public.claw_deployer_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  funded_sol NUMERIC DEFAULT 0,
  remaining_sol NUMERIC DEFAULT 0,
  token_mint TEXT,
  reclaimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.claw_deployer_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claw_deployer_wallets_public_read" ON public.claw_deployer_wallets FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX idx_claw_tokens_agent_id ON public.claw_tokens(agent_id);
CREATE INDEX idx_claw_tokens_market_cap ON public.claw_tokens(market_cap_sol DESC NULLS LAST);
CREATE INDEX idx_claw_agent_tokens_agent_id ON public.claw_agent_tokens(agent_id);
CREATE INDEX idx_claw_agent_tokens_fun_token_id ON public.claw_agent_tokens(fun_token_id);
CREATE INDEX idx_claw_trading_agents_status ON public.claw_trading_agents(status);
CREATE INDEX idx_claw_trading_agents_profit ON public.claw_trading_agents(total_profit_sol DESC NULLS LAST);
CREATE INDEX idx_claw_trading_positions_agent ON public.claw_trading_positions(trading_agent_id);
CREATE INDEX idx_claw_trading_positions_status ON public.claw_trading_positions(status);
CREATE INDEX idx_claw_trading_trades_agent ON public.claw_trading_trades(trading_agent_id);
CREATE INDEX idx_claw_posts_community ON public.claw_posts(subtuna_id);
CREATE INDEX idx_claw_fee_claims_token ON public.claw_fee_claims(fun_token_id);
