-- Add short_id column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS short_id text;

-- Create unique index for short_id
CREATE UNIQUE INDEX IF NOT EXISTS posts_short_id_idx ON public.posts(short_id) WHERE short_id IS NOT NULL;

-- Function to generate a short ID (8 chars, alphanumeric)
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger function to auto-generate short_id on insert
CREATE OR REPLACE FUNCTION public.set_post_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_short_id text;
  retry_count integer := 0;
BEGIN
  IF NEW.short_id IS NULL THEN
    LOOP
      new_short_id := public.generate_short_id();
      BEGIN
        NEW.short_id := new_short_id;
        RETURN NEW;
      EXCEPTION WHEN unique_violation THEN
        retry_count := retry_count + 1;
        IF retry_count > 5 THEN
          RAISE EXCEPTION 'Could not generate unique short_id after 5 attempts';
        END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_post_short_id_trigger ON public.posts;
CREATE TRIGGER set_post_short_id_trigger
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_short_id();