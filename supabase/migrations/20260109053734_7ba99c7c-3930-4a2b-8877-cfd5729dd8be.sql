-- Fix search_path for generate_short_id function
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
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

-- Fix search_path for set_post_short_id function
CREATE OR REPLACE FUNCTION public.set_post_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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