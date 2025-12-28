-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Trigger for updating conversation
CREATE TRIGGER on_message_sent
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_message();

-- Function to create notification on like
CREATE OR REPLACE FUNCTION public.create_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id UUID;
  post_content TEXT;
BEGIN
  SELECT user_id, LEFT(content, 100) INTO post_owner_id, post_content
  FROM public.posts WHERE id = NEW.post_id;
  
  IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id, content)
    VALUES (post_owner_id, NEW.user_id, 'like', NEW.post_id, post_content);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create notification on follow
CREATE OR REPLACE FUNCTION public.create_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  
  RETURN NEW;
END;
$$;

-- Function to create notification on reply
CREATE OR REPLACE FUNCTION public.create_reply_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_owner_id UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_owner_id
    FROM public.posts WHERE id = NEW.parent_id;
    
    IF parent_owner_id IS NOT NULL AND parent_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, post_id, content)
      VALUES (parent_owner_id, NEW.user_id, 'reply', NEW.id, LEFT(NEW.content, 100));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create notification on repost
CREATE OR REPLACE FUNCTION public.create_repost_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_owner_id UUID;
  original_content TEXT;
BEGIN
  IF NEW.is_repost = true AND NEW.original_post_id IS NOT NULL THEN
    SELECT user_id, LEFT(content, 100) INTO original_owner_id, original_content
    FROM public.posts WHERE id = NEW.original_post_id;
    
    IF original_owner_id IS NOT NULL AND original_owner_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, actor_id, type, post_id, content)
      VALUES (original_owner_id, NEW.user_id, 'repost', NEW.original_post_id, original_content);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for notifications
CREATE TRIGGER on_like_created
AFTER INSERT ON public.likes
FOR EACH ROW
EXECUTE FUNCTION public.create_like_notification();

CREATE TRIGGER on_follow_created
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.create_follow_notification();

CREATE TRIGGER on_reply_created
AFTER INSERT ON public.posts
FOR EACH ROW
WHEN (NEW.parent_id IS NOT NULL)
EXECUTE FUNCTION public.create_reply_notification();

CREATE TRIGGER on_post_reposted
AFTER INSERT ON public.posts
FOR EACH ROW
WHEN (NEW.is_repost = true)
EXECUTE FUNCTION public.create_repost_notification();

-- Create storage bucket for DM images
INSERT INTO storage.buckets (id, name, public)
VALUES ('dm-images', 'dm-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for DM images
CREATE POLICY "Users can upload DM images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dm-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view DM images in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dm-images' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own DM images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'dm-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);