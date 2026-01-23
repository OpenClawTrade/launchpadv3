-- Allow public read access to twitter_bot_replies for admin page
-- The page itself handles authorization via wallet address check
CREATE POLICY "Allow read access to twitter bot replies"
ON public.twitter_bot_replies
FOR SELECT
USING (true);