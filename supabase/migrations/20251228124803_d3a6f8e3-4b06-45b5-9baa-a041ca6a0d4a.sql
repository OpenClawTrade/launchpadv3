-- =============================================
-- TRENDING ALGORITHM TABLES
-- =============================================

-- Hashtags table to track all topics
CREATE TABLE public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Post-hashtag relationship (many-to-many)
CREATE TABLE public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, hashtag_id)
);

-- Trending snapshots (calculated periodically)
CREATE TABLE public.trending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'General',
  score FLOAT NOT NULL DEFAULT 0,
  post_count_1h INTEGER DEFAULT 0,
  post_count_24h INTEGER DEFAULT 0,
  velocity FLOAT DEFAULT 0,
  rank INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - hashtags are public readable
CREATE POLICY "Hashtags are viewable by everyone" 
ON public.hashtags FOR SELECT USING (true);

CREATE POLICY "System can manage hashtags" 
ON public.hashtags FOR ALL USING (true);

-- Post hashtags are public readable
CREATE POLICY "Post hashtags are viewable by everyone" 
ON public.post_hashtags FOR SELECT USING (true);

CREATE POLICY "Users can create post hashtags for their posts" 
ON public.post_hashtags FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));

-- Trending topics are public readable
CREATE POLICY "Trending topics are viewable by everyone" 
ON public.trending_topics FOR SELECT USING (true);

CREATE POLICY "System can manage trending topics" 
ON public.trending_topics FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_post_hashtags_post_id ON public.post_hashtags(post_id);
CREATE INDEX idx_post_hashtags_hashtag_id ON public.post_hashtags(hashtag_id);
CREATE INDEX idx_post_hashtags_created_at ON public.post_hashtags(created_at);
CREATE INDEX idx_trending_topics_rank ON public.trending_topics(rank);
CREATE INDEX idx_trending_topics_calculated_at ON public.trending_topics(calculated_at);

-- =============================================
-- FUNCTION: Extract hashtags from post content
-- =============================================
CREATE OR REPLACE FUNCTION public.extract_hashtags_from_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hashtag_match TEXT;
  hashtag_id_var UUID;
BEGIN
  -- Extract all hashtags from the post content
  FOR hashtag_match IN 
    SELECT DISTINCT lower(regexp_replace(match[1], '^#', ''))
    FROM regexp_matches(NEW.content, '#([a-zA-Z0-9_]+)', 'g') AS match
  LOOP
    -- Insert hashtag if it doesn't exist, get the ID
    INSERT INTO public.hashtags (name)
    VALUES (hashtag_match)
    ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + 1
    RETURNING id INTO hashtag_id_var;
    
    -- If hashtag existed, we need to get its ID
    IF hashtag_id_var IS NULL THEN
      SELECT id INTO hashtag_id_var FROM public.hashtags WHERE name = hashtag_match;
      UPDATE public.hashtags SET post_count = post_count + 1 WHERE id = hashtag_id_var;
    END IF;
    
    -- Link post to hashtag
    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, hashtag_id_var)
    ON CONFLICT (post_id, hashtag_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to extract hashtags when a post is created
CREATE TRIGGER on_post_created_extract_hashtags
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.extract_hashtags_from_post();

-- =============================================
-- FUNCTION: Calculate trending scores
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_trending_topics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear old trending data
  DELETE FROM public.trending_topics;
  
  -- Insert new trending calculations
  INSERT INTO public.trending_topics (hashtag_id, category, score, post_count_1h, post_count_24h, velocity, rank)
  SELECT 
    h.id,
    'General'::TEXT,
    -- Score formula: recent posts weighted higher + velocity bonus
    (COALESCE(counts.count_1h, 0) * 3 + COALESCE(counts.count_6h, 0) * 2 + COALESCE(counts.count_24h, 0))::FLOAT +
    CASE 
      WHEN COALESCE(counts.count_24h, 0) > 0 
      THEN (COALESCE(counts.count_1h, 0)::FLOAT / counts.count_24h::FLOAT) * 10
      ELSE 0
    END,
    COALESCE(counts.count_1h, 0),
    COALESCE(counts.count_24h, 0),
    CASE 
      WHEN COALESCE(counts.count_24h, 0) > 0 
      THEN (COALESCE(counts.count_1h, 0)::FLOAT / counts.count_24h::FLOAT)
      ELSE 0
    END,
    ROW_NUMBER() OVER (ORDER BY 
      (COALESCE(counts.count_1h, 0) * 3 + COALESCE(counts.count_6h, 0) * 2 + COALESCE(counts.count_24h, 0))::FLOAT +
      CASE 
        WHEN COALESCE(counts.count_24h, 0) > 0 
        THEN (COALESCE(counts.count_1h, 0)::FLOAT / counts.count_24h::FLOAT) * 10
        ELSE 0
      END DESC
    )
  FROM public.hashtags h
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*) FILTER (WHERE ph.created_at > NOW() - INTERVAL '1 hour') as count_1h,
      COUNT(*) FILTER (WHERE ph.created_at > NOW() - INTERVAL '6 hours') as count_6h,
      COUNT(*) FILTER (WHERE ph.created_at > NOW() - INTERVAL '24 hours') as count_24h
    FROM public.post_hashtags ph
    WHERE ph.hashtag_id = h.id
  ) counts ON true
  WHERE COALESCE(counts.count_24h, 0) > 0
  ORDER BY score DESC
  LIMIT 20;
END;
$$;

-- =============================================
-- FUNCTION: Get suggested users to follow
-- =============================================
CREATE OR REPLACE FUNCTION public.get_suggested_users(current_user_id UUID, limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  verified_type TEXT,
  bio TEXT,
  followers_count INTEGER,
  suggestion_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH already_following AS (
    SELECT following_id FROM public.follows WHERE follower_id = current_user_id
  ),
  mutual_follows AS (
    -- People followed by people you follow (friends of friends)
    SELECT 
      f2.following_id as user_id,
      COUNT(*)::FLOAT * 4 as score
    FROM public.follows f1
    JOIN public.follows f2 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = current_user_id
      AND f2.following_id != current_user_id
      AND f2.following_id NOT IN (SELECT following_id FROM already_following)
    GROUP BY f2.following_id
  ),
  similar_engagement AS (
    -- Users who liked the same posts you liked
    SELECT 
      l2.user_id,
      COUNT(*)::FLOAT * 2.5 as score
    FROM public.likes l1
    JOIN public.likes l2 ON l1.post_id = l2.post_id
    WHERE l1.user_id = current_user_id
      AND l2.user_id != current_user_id
      AND l2.user_id NOT IN (SELECT following_id FROM already_following)
    GROUP BY l2.user_id
  ),
  active_users AS (
    -- Users who posted recently
    SELECT 
      p.user_id,
      COUNT(*)::FLOAT as score
    FROM public.posts p
    WHERE p.created_at > NOW() - INTERVAL '7 days'
      AND p.user_id != current_user_id
      AND p.user_id NOT IN (SELECT following_id FROM already_following)
    GROUP BY p.user_id
  )
  SELECT 
    pr.id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    pr.verified_type,
    pr.bio,
    COALESCE(pr.followers_count, 0)::INTEGER,
    (
      COALESCE(mf.score, 0) +
      COALESCE(se.score, 0) +
      COALESCE(au.score, 0) * 0.5 +
      CASE WHEN pr.verified_type IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN COALESCE(pr.posts_count, 0) > 5 THEN 10 ELSE 0 END +
      LOG(GREATEST(COALESCE(pr.followers_count, 0), 1) + 1) * 2
    )::FLOAT as suggestion_score
  FROM public.profiles pr
  LEFT JOIN mutual_follows mf ON pr.id = mf.user_id
  LEFT JOIN similar_engagement se ON pr.id = se.user_id
  LEFT JOIN active_users au ON pr.id = au.user_id
  WHERE pr.id != current_user_id
    AND pr.id NOT IN (SELECT following_id FROM already_following)
  ORDER BY suggestion_score DESC, pr.followers_count DESC NULLS LAST
  LIMIT limit_count;
END;
$$;