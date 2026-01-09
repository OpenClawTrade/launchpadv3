-- Fix the hashtag extraction function to properly track post counts
CREATE OR REPLACE FUNCTION public.extract_hashtags_from_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  hashtag_match TEXT;
  hashtag_id_var UUID;
BEGIN
  -- Extract all hashtags from the post content (both # and $ tags)
  FOR hashtag_match IN 
    SELECT DISTINCT lower(regexp_replace(match[1], '^[#$]', ''))
    FROM regexp_matches(NEW.content, '[#$]([a-zA-Z][a-zA-Z0-9_]*)', 'g') AS match
  LOOP
    -- Insert hashtag if it doesn't exist
    INSERT INTO public.hashtags (name, post_count)
    VALUES (hashtag_match, 1)
    ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + 1
    RETURNING id INTO hashtag_id_var;
    
    -- Link post to hashtag
    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, hashtag_id_var)
    ON CONFLICT (post_id, hashtag_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$;