-- Add slug column to subtuna_posts
ALTER TABLE public.subtuna_posts
ADD COLUMN slug TEXT;

-- Create helper function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_post_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Lowercase, replace non-alphanumeric with hyphens
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  -- Limit to 60 chars at word boundary
  IF length(base_slug) > 60 THEN
    base_slug := substring(base_slug from 1 for 60);
    base_slug := regexp_replace(base_slug, '-[^-]*$', '');
  END IF;
  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to auto-generate slug on insert
CREATE OR REPLACE FUNCTION public.auto_generate_post_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base slug from title
  base_slug := public.generate_post_slug(NEW.title);
  final_slug := base_slug;
  
  -- Check for uniqueness within the same subtuna and add suffix if needed
  WHILE EXISTS (
    SELECT 1 FROM public.subtuna_posts 
    WHERE subtuna_id = NEW.subtuna_id 
    AND slug = final_slug 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slugs on INSERT
CREATE TRIGGER set_post_slug
BEFORE INSERT ON public.subtuna_posts
FOR EACH ROW
WHEN (NEW.slug IS NULL)
EXECUTE FUNCTION public.auto_generate_post_slug();

-- Create index for faster slug lookups
CREATE INDEX idx_subtuna_posts_slug ON public.subtuna_posts(slug);

-- Create unique constraint on slug within each subtuna
CREATE UNIQUE INDEX idx_subtuna_posts_subtuna_slug ON public.subtuna_posts(subtuna_id, slug);