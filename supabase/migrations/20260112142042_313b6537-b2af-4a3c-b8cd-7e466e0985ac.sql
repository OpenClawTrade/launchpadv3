-- Create a function to allow the backend to create system posts
CREATE OR REPLACE FUNCTION public.backend_create_system_post(
  p_user_id UUID,
  p_content TEXT,
  p_image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  INSERT INTO public.posts (user_id, content, image_url)
  VALUES (p_user_id, p_content, p_image_url)
  RETURNING id INTO v_post_id;
  
  -- Update the user's post count
  UPDATE public.profiles
  SET posts_count = COALESCE(posts_count, 0) + 1
  WHERE id = p_user_id;
  
  RETURN v_post_id;
END;
$$;

-- Grant execute permission to anon role for Vercel API
GRANT EXECUTE ON FUNCTION public.backend_create_system_post(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.backend_create_system_post(UUID, TEXT, TEXT) TO authenticated;