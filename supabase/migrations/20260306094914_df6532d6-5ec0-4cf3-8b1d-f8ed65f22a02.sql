
-- Referral rewards tracking table
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  trade_signature TEXT,
  trade_sol_amount NUMERIC NOT NULL DEFAULT 0,
  reward_sol NUMERIC NOT NULL DEFAULT 0,
  reward_pct NUMERIC NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_referral_rewards_referrer ON public.referral_rewards(referrer_id);
CREATE INDEX idx_referral_rewards_referred ON public.referral_rewards(referred_id);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Referrers can see their own rewards
CREATE POLICY "Users can read own referral rewards" 
  ON public.referral_rewards FOR SELECT TO authenticated 
  USING (referrer_id = auth.uid());

-- System inserts via edge function (service role)
CREATE POLICY "Service can insert referral rewards" 
  ON public.referral_rewards FOR INSERT TO authenticated 
  WITH CHECK (true);

-- Add total_rewards_sol to referrals for quick lookup
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS total_rewards_sol NUMERIC DEFAULT 0;

-- Function to get referrer for a given user
CREATE OR REPLACE FUNCTION public.get_referrer_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT referrer_id FROM referrals WHERE referred_id = p_user_id LIMIT 1;
$$;

-- Function to get referral stats for dashboard
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_referrer_id UUID)
RETURNS TABLE(
  total_referrals BIGINT,
  total_rewards_sol NUMERIC,
  rewards_this_month NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM referrals WHERE referrer_id = p_referrer_id)::BIGINT,
    COALESCE((SELECT SUM(reward_sol) FROM referral_rewards WHERE referrer_id = p_referrer_id), 0),
    COALESCE((SELECT SUM(reward_sol) FROM referral_rewards WHERE referrer_id = p_referrer_id AND created_at >= date_trunc('month', now())), 0);
$$;
