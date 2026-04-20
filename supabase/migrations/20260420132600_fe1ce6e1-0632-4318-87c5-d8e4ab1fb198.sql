-- Token page view tracking
CREATE TABLE IF NOT EXISTS public.token_views (
  token_address text PRIMARY KEY,
  view_count bigint NOT NULL DEFAULT 0,
  unique_count bigint NOT NULL DEFAULT 0,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_views_count ON public.token_views (view_count DESC);

-- Per-visitor dedup (hashed visitor id + token + day) so unique_count is accurate
CREATE TABLE IF NOT EXISTS public.token_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL,
  visitor_hash text NOT NULL,
  viewed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_address, visitor_hash, viewed_on)
);

CREATE INDEX IF NOT EXISTS idx_token_view_events_token ON public.token_view_events (token_address);

ALTER TABLE public.token_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_view_events ENABLE ROW LEVEL SECURITY;

-- Public can read aggregated counts
CREATE POLICY "Anyone can read token view counts"
  ON public.token_views FOR SELECT
  USING (true);

-- Only service role writes (edge function uses service role)
CREATE POLICY "Service role manages token_views"
  ON public.token_views FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages token_view_events"
  ON public.token_view_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Atomic increment helper used by edge function
CREATE OR REPLACE FUNCTION public.increment_token_view(
  p_token_address text,
  p_visitor_hash text
) RETURNS TABLE(view_count bigint, unique_count bigint, was_unique boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_unique boolean := false;
  v_view_count bigint;
  v_unique_count bigint;
BEGIN
  -- Try to record this visitor for today; if already exists, NOT unique
  INSERT INTO public.token_view_events (token_address, visitor_hash)
  VALUES (p_token_address, p_visitor_hash)
  ON CONFLICT (token_address, visitor_hash, viewed_on) DO NOTHING;

  GET DIAGNOSTICS v_was_unique = ROW_COUNT;

  -- Upsert aggregate (always bump view_count; bump unique_count only on first-of-day)
  INSERT INTO public.token_views (token_address, view_count, unique_count, last_viewed_at)
  VALUES (p_token_address, 1, CASE WHEN v_was_unique THEN 1 ELSE 0 END, now())
  ON CONFLICT (token_address) DO UPDATE
    SET view_count = public.token_views.view_count + 1,
        unique_count = public.token_views.unique_count + CASE WHEN v_was_unique THEN 1 ELSE 0 END,
        last_viewed_at = now()
  RETURNING public.token_views.view_count, public.token_views.unique_count
    INTO v_view_count, v_unique_count;

  RETURN QUERY SELECT v_view_count, v_unique_count, v_was_unique;
END;
$$;