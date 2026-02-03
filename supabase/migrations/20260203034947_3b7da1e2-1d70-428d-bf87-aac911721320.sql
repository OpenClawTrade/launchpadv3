-- Part A: Add twitter_username column to fun_distributions for per-user cooldown tracking
ALTER TABLE public.fun_distributions 
ADD COLUMN IF NOT EXISTS twitter_username TEXT;

-- Add index for efficient cooldown lookups
CREATE INDEX IF NOT EXISTS idx_fun_distributions_twitter_username 
ON public.fun_distributions(twitter_username) 
WHERE twitter_username IS NOT NULL;

-- Part B: Create creator_claim_locks table for preventing double-claims
CREATE TABLE IF NOT EXISTS public.creator_claim_locks (
  twitter_username TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Part C: Create lock acquisition function
CREATE OR REPLACE FUNCTION public.acquire_creator_claim_lock(
  p_twitter_username TEXT,
  p_duration_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
BEGIN
  -- Try to insert new lock or update expired one
  INSERT INTO public.creator_claim_locks (twitter_username, locked_at, expires_at)
  VALUES (
    lower(p_twitter_username),
    now(),
    now() + (p_duration_seconds || ' seconds')::interval
  )
  ON CONFLICT (twitter_username) DO UPDATE
  SET locked_at = now(),
      expires_at = now() + (p_duration_seconds || ' seconds')::interval
  WHERE creator_claim_locks.expires_at < now();
  
  -- Check if we got the lock
  IF FOUND THEN
    v_acquired := TRUE;
  END IF;
  
  RETURN v_acquired;
END;
$$;

-- Part D: Create lock release function
CREATE OR REPLACE FUNCTION public.release_creator_claim_lock(
  p_twitter_username TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.creator_claim_locks 
  WHERE twitter_username = lower(p_twitter_username);
END;
$$;

-- Part E: Backfill agents.style_source_username from twitter_handle
UPDATE public.agents
SET style_source_username = lower(twitter_handle)
WHERE style_source_username IS NULL 
  AND twitter_handle IS NOT NULL;

-- Part F: Backfill from agent_social_posts for agents still missing style_source_username
UPDATE public.agents a
SET style_source_username = sub.post_author
FROM (
  SELECT DISTINCT ON (ft.agent_id) 
    ft.agent_id,
    lower(asp.post_author) as post_author
  FROM public.fun_tokens ft
  JOIN public.agent_social_posts asp ON asp.fun_token_id = ft.id
  WHERE ft.agent_id IS NOT NULL 
    AND asp.post_author IS NOT NULL
    AND asp.platform = 'twitter'
  ORDER BY ft.agent_id, asp.created_at DESC
) sub
WHERE a.id = sub.agent_id
  AND a.style_source_username IS NULL;