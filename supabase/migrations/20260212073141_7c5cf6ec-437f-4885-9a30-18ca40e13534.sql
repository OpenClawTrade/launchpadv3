
-- Create table for storing follower scan results
CREATE TABLE public.x_follower_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_username TEXT NOT NULL,
  twitter_user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  profile_picture TEXT,
  description TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  statuses_count INTEGER DEFAULT 0,
  verification_type TEXT NOT NULL DEFAULT 'unverified',
  is_blue_verified BOOLEAN DEFAULT false,
  is_gold_verified BOOLEAN DEFAULT false,
  location TEXT,
  created_at_twitter TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(target_username, twitter_user_id)
);

-- Enable RLS
ALTER TABLE public.x_follower_scans ENABLE ROW LEVEL SECURITY;

-- Public RLS policies (consistent with other admin tables)
CREATE POLICY "Allow public read access" ON public.x_follower_scans FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.x_follower_scans FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.x_follower_scans FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.x_follower_scans FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_x_follower_scans_target ON public.x_follower_scans(target_username);
CREATE INDEX idx_x_follower_scans_verification ON public.x_follower_scans(target_username, verification_type);
CREATE INDEX idx_x_follower_scans_following ON public.x_follower_scans(target_username, following_count DESC);
