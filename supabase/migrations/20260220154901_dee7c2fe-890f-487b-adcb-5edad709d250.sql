-- Add unique constraint on tweet_id to prevent duplicate replies via race condition
ALTER TABLE public.twitter_bot_replies ADD CONSTRAINT twitter_bot_replies_tweet_id_unique UNIQUE (tweet_id);