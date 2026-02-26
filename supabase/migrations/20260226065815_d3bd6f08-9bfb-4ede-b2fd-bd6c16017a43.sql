
-- Single-row counter for total punches
CREATE TABLE public.punch_counters (
  id text PRIMARY KEY DEFAULT 'global',
  total_punches bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.punch_counters (id, total_punches) VALUES ('global', 0);

ALTER TABLE public.punch_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read punch counters" ON public.punch_counters FOR SELECT USING (true);

-- Unique visitors tracking
CREATE TABLE public.punch_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.punch_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read punch visitors" ON public.punch_visitors FOR SELECT USING (true);
CREATE POLICY "Anyone can insert punch visitors" ON public.punch_visitors FOR INSERT WITH CHECK (true);

-- Atomic increment function
CREATE OR REPLACE FUNCTION public.increment_punch_count(p_count integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.punch_counters SET total_punches = total_punches + p_count, updated_at = now() WHERE id = 'global';
END;
$$;

-- Enable realtime for live counter updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_counters;
