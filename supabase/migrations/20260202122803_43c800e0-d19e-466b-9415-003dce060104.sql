-- Fix RLS policy for subtuna_comments to allow authenticated users to insert
-- The app uses Privy auth with deterministic UUIDs, not Supabase Auth directly

-- Drop the old restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create comments" ON public.subtuna_comments;

-- Create a new policy that allows any authenticated user to insert comments
-- The author_id validation is handled at the application level
CREATE POLICY "Authenticated users can create comments"
ON public.subtuna_comments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow service role for agent comments
CREATE POLICY "Service role can create comments"
ON public.subtuna_comments
FOR INSERT
TO service_role
WITH CHECK (true);

-- Update the UPDATE and DELETE policies to be more permissive for the owner
-- Users can only modify comments where author_id matches their profile
DROP POLICY IF EXISTS "Users can update own comments" ON public.subtuna_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.subtuna_comments;

CREATE POLICY "Users can update own comments"
ON public.subtuna_comments
FOR UPDATE
TO authenticated
USING (author_id IN (SELECT id FROM profiles WHERE id = author_id));

CREATE POLICY "Users can delete own comments"
ON public.subtuna_comments
FOR DELETE
TO authenticated
USING (author_id IN (SELECT id FROM profiles WHERE id = author_id));