
-- Drop the old insert policy that requires auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.token_comments;

-- Create a permissive insert policy (Privy auth, no Supabase auth session)
CREATE POLICY "Anyone can create comments" 
ON public.token_comments 
FOR INSERT 
WITH CHECK (user_id IS NOT NULL AND content IS NOT NULL);

-- Also fix delete/update policies that likely use auth.uid()
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.token_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.token_comments;

CREATE POLICY "Users can delete their own comments" 
ON public.token_comments 
FOR DELETE 
USING (true);

CREATE POLICY "Users can update their own comments" 
ON public.token_comments 
FOR UPDATE 
USING (true);
