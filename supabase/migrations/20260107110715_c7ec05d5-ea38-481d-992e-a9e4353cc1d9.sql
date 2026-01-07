-- Create app_role enum for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to check if current user is admin (for easy frontend use)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Admin view for reports with user info
CREATE OR REPLACE VIEW public.admin_reports_view AS
SELECT 
  r.*,
  reporter.username as reporter_username,
  reporter.display_name as reporter_display_name,
  reported_user.username as reported_username,
  reported_user.display_name as reported_display_name,
  p.content as post_content,
  post_author.username as post_author_username
FROM public.reports r
LEFT JOIN public.profiles reporter ON r.reporter_id = reporter.id
LEFT JOIN public.profiles reported_user ON r.reported_user_id = reported_user.id
LEFT JOIN public.posts p ON r.reported_post_id = p.id
LEFT JOIN public.profiles post_author ON p.user_id = post_author.id;

-- Grant access to the view for authenticated users (RLS will handle permissions)
GRANT SELECT ON public.admin_reports_view TO authenticated;

-- Add policy for admins to update reports status
CREATE POLICY "Admins can update report status"
ON public.reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add policy for admins to delete any posts (moderation)
CREATE POLICY "Admins can delete any posts"
ON public.posts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));