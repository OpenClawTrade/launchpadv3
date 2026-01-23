-- Revert overly-permissive policy added earlier
DROP POLICY IF EXISTS "Allow read access to twitter bot replies" ON public.twitter_bot_replies;