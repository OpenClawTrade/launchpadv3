-- Add pinned columns to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pinned_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pinned_by uuid DEFAULT NULL;

-- Create index for efficient pinned posts queries
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON public.posts (pinned, pinned_at DESC) WHERE pinned = true;

-- Create a function to check if user can pin posts (admin or gold verified)
CREATE OR REPLACE FUNCTION public.can_pin_posts(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is admin
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    -- Check if user has gold verification
    SELECT 1 FROM public.profiles WHERE id = _user_id AND verified_type = 'gold'
  )
$$;

-- Allow users with pin permission to update the pinned status
CREATE POLICY "Users with pin permission can pin posts"
ON public.posts
FOR UPDATE
USING (public.can_pin_posts(auth.uid()))
WITH CHECK (public.can_pin_posts(auth.uid()));