-- Fix search_path for get_suggested_users function
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no user is logged in, return popular users
  IF current_user_id IS NULL THEN
    RETURN QUERY
    SELECT 
      pr.id,
      pr.username,
      pr.display_name,
      pr.avatar_url,
      pr.verified_type,
      pr.bio,
      COALESCE(pr.followers_count, 0)::INTEGER,
      (COALESCE(pr.followers_count, 0)::FLOAT + 
       CASE WHEN pr.verified_type IS NOT NULL THEN 100 ELSE 0 END)::FLOAT as suggestion_score
    FROM public.profiles pr
    ORDER BY suggestion_score DESC, pr.created_at DESC
    LIMIT limit_count;
    RETURN;
  END IF;

  RETURN QUERY
  WITH already_following AS (
    SELECT following_id FROM public.follows WHERE follower_id = current_user_id
  ),
  mutual_follows AS (
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