-- Add detailed analysis columns to trading_agent_trades
ALTER TABLE public.trading_agent_trades 
ADD COLUMN IF NOT EXISTS entry_analysis text,
ADD COLUMN IF NOT EXISTS exit_analysis text,
ADD COLUMN IF NOT EXISTS ai_reasoning text,
ADD COLUMN IF NOT EXISTS market_context text,
ADD COLUMN IF NOT EXISTS lessons_learned text,
ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtuna_post_id uuid REFERENCES subtuna_posts(id);

-- Add detailed analysis columns to trading_agent_positions  
ALTER TABLE public.trading_agent_positions
ADD COLUMN IF NOT EXISTS strategy_adjustments text,
ADD COLUMN IF NOT EXISTS market_conditions text,
ADD COLUMN IF NOT EXISTS risk_assessment text,
ADD COLUMN IF NOT EXISTS target_price_sol numeric,
ADD COLUMN IF NOT EXISTS stop_loss_price_sol numeric,
ADD COLUMN IF NOT EXISTS trailing_stop_active boolean DEFAULT false;

-- Add learning/memory columns to trading_agents
ALTER TABLE public.trading_agents
ADD COLUMN IF NOT EXISTS trading_style text,
ADD COLUMN IF NOT EXISTS learned_patterns jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS strategy_notes text,
ADD COLUMN IF NOT EXISTS last_strategy_review timestamp with time zone,
ADD COLUMN IF NOT EXISTS consecutive_wins integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_losses integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_trade_sol numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS worst_trade_sol numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_hold_time_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_narratives text[],
ADD COLUMN IF NOT EXISTS avoided_patterns text[];

-- Create trading agent strategy reviews table for learning
CREATE TABLE IF NOT EXISTS public.trading_agent_strategy_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trading_agent_id uuid NOT NULL REFERENCES trading_agents(id) ON DELETE CASCADE,
  review_type text NOT NULL DEFAULT 'periodic', -- periodic, after_loss, after_win_streak
  trades_analyzed integer DEFAULT 0,
  win_rate_at_review numeric,
  total_pnl_at_review numeric,
  key_insights text,
  strategy_adjustments text,
  new_rules text[],
  deprecated_rules text[],
  confidence_level numeric DEFAULT 50,
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_strategy_reviews_agent 
ON trading_agent_strategy_reviews(trading_agent_id, created_at DESC);

-- Enable RLS
ALTER TABLE trading_agent_strategy_reviews ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Anyone can view strategy reviews"
ON trading_agent_strategy_reviews FOR SELECT USING (true);

-- Service role write
CREATE POLICY "Service role can manage reviews"
ON trading_agent_strategy_reviews FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');