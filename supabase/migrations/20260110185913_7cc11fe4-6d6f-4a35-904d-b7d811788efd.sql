-- Update can_pin_posts to only allow admins (remove gold users)
CREATE OR REPLACE FUNCTION public.can_pin_posts(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Check if user is admin only
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  )
$$;