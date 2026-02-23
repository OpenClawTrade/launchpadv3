
-- Function to upsert user topic with proper increment
CREATE OR REPLACE FUNCTION public.upsert_bot_user_topic(
  p_account_id UUID,
  p_tweet_author_id TEXT,
  p_tweet_author_username TEXT,
  p_topic TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.x_bot_user_topics (
    account_id, tweet_author_id, tweet_author_username, topic, ask_count, last_asked_at, first_asked_at
  ) VALUES (
    p_account_id, p_tweet_author_id, p_tweet_author_username, lower(p_topic), 1, now(), now()
  )
  ON CONFLICT (account_id, tweet_author_id, topic) DO UPDATE SET
    ask_count = x_bot_user_topics.ask_count + 1,
    last_asked_at = now(),
    tweet_author_username = EXCLUDED.tweet_author_username;
END;
$$;
