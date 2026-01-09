-- First, update existing posts_count to match actual post counts
UPDATE public.profiles p
SET posts_count = (
  SELECT COUNT(*) 
  FROM public.posts 
  WHERE user_id = p.id AND parent_id IS NULL
);

-- Create function to increment posts_count when a new post is created
CREATE OR REPLACE FUNCTION public.increment_posts_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only count top-level posts (not replies)
  IF NEW.parent_id IS NULL THEN
    UPDATE public.profiles 
    SET posts_count = COALESCE(posts_count, 0) + 1 
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create function to decrement posts_count when a post is deleted
CREATE OR REPLACE FUNCTION public.decrement_posts_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only count top-level posts (not replies)
  IF OLD.parent_id IS NULL THEN
    UPDATE public.profiles 
    SET posts_count = GREATEST(COALESCE(posts_count, 0) - 1, 0) 
    WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger for new posts
DROP TRIGGER IF EXISTS on_post_created ON public.posts;
CREATE TRIGGER on_post_created
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_posts_count();

-- Create trigger for deleted posts
DROP TRIGGER IF EXISTS on_post_deleted ON public.posts;
CREATE TRIGGER on_post_deleted
  AFTER DELETE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_posts_count();