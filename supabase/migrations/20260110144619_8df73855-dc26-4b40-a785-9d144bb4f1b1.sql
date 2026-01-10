-- Update the extract_hashtags_from_post function to also extract cashtags ($TICKER)
CREATE OR REPLACE FUNCTION public.extract_hashtags_from_post()
RETURNS TRIGGER AS $$
DECLARE
  tag_match TEXT;
  tag_name TEXT;
  tag_id UUID;
BEGIN
  -- Extract both hashtags (#word) and cashtags ($WORD) from post content
  FOR tag_match IN
    SELECT DISTINCT (regexp_matches(NEW.content, '(#[a-zA-Z0-9_]+|\$[a-zA-Z0-9_]+)', 'g'))[1]
  LOOP
    -- Convert to lowercase for consistency
    tag_name := lower(tag_match);
    
    -- Insert or get existing hashtag/cashtag
    INSERT INTO public.hashtags (name, post_count)
    VALUES (tag_name, 1)
    ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + 1
    RETURNING id INTO tag_id;
    
    -- Link post to hashtag/cashtag
    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, tag_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill existing cashtags from posts
DO $$
DECLARE
  post_record RECORD;
  tag_match TEXT;
  tag_name TEXT;
  tag_id UUID;
BEGIN
  FOR post_record IN SELECT id, content FROM public.posts WHERE content LIKE '%$%' LOOP
    FOR tag_match IN
      SELECT DISTINCT (regexp_matches(post_record.content, '\$[a-zA-Z0-9_]+', 'g'))[1]
    LOOP
      tag_name := lower(tag_match);
      
      INSERT INTO public.hashtags (name, post_count)
      VALUES (tag_name, 1)
      ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + 1
      RETURNING id INTO tag_id;
      
      INSERT INTO public.post_hashtags (post_id, hashtag_id)
      VALUES (post_record.id, tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;