
CREATE TABLE public.twitter_profile_cache (
  username text PRIMARY KEY,
  profile_image_url text,
  verified boolean DEFAULT false,
  verified_type text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.twitter_profile_cache ENABLE ROW LEVEL SECURITY;

-- No public access needed - only edge functions with service role access this
