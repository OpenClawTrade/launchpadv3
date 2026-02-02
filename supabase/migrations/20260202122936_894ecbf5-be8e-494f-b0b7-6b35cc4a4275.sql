-- Allow anonymous role to insert comments since the app uses Privy auth, not Supabase Auth
-- The author_id is validated at the application level

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.subtuna_comments;

-- Allow public (anon + authenticated) to insert comments
CREATE POLICY "Anyone can create comments"
ON public.subtuna_comments
FOR INSERT
TO public
WITH CHECK (true);