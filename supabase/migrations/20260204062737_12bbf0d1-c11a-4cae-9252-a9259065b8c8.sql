-- Add public SELECT policy for promo_mention_replies (admin table, read-only for monitoring)
CREATE POLICY "Allow public read access to promo_mention_replies"
ON public.promo_mention_replies
FOR SELECT
USING (true);