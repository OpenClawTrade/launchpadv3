-- Drop existing trigger and function with CASCADE
DROP TRIGGER IF EXISTS on_post_created_extract_hashtags ON posts;
DROP TRIGGER IF EXISTS extract_hashtags_trigger ON posts;
DROP FUNCTION IF EXISTS extract_hashtags_from_post() CASCADE;

-- Create improved function to extract hashtags and cashtags with proper counting
CREATE OR REPLACE FUNCTION extract_hashtags_from_post()
RETURNS TRIGGER AS $$
DECLARE
  tag_match TEXT;
  tag_name TEXT;
  tag_id UUID;
BEGIN
  -- Only process on INSERT (not updates to avoid double counting)
  IF TG_OP = 'INSERT' THEN
    -- Extract hashtags (#word) and cashtags ($WORD)
    FOR tag_match IN
      SELECT DISTINCT (regexp_matches(NEW.content, '(?:^|[^a-zA-Z0-9])([#$][a-zA-Z][a-zA-Z0-9_]*)', 'gi'))[1]
    LOOP
      -- Remove the # or $ prefix and lowercase
      tag_name := lower(substring(tag_match from 2));
      
      -- Skip if empty
      IF length(tag_name) < 1 THEN
        CONTINUE;
      END IF;
      
      -- Insert hashtag or get existing one, and increment count
      INSERT INTO hashtags (name, post_count)
      VALUES (tag_name, 1)
      ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + 1
      RETURNING id INTO tag_id;
      
      -- Link post to hashtag (if not already linked)
      INSERT INTO post_hashtags (post_id, hashtag_id)
      VALUES (NEW.id, tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER on_post_created_extract_hashtags
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION extract_hashtags_from_post();