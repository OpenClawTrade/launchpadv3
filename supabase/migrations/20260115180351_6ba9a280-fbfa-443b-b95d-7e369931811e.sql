-- Create narrative_history table to store historical narratives with timestamps
CREATE TABLE IF NOT EXISTS public.narrative_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  narrative TEXT NOT NULL,
  description TEXT,
  example_tokens TEXT[],
  token_count INTEGER DEFAULT 0,
  popularity_score NUMERIC DEFAULT 0,
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.narrative_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for analytics)
CREATE POLICY "Anyone can read narrative history" 
  ON public.narrative_history 
  FOR SELECT 
  USING (true);

-- Add index for efficient queries by time
CREATE INDEX idx_narrative_history_snapshot_at ON public.narrative_history(snapshot_at DESC);

-- Add index for narrative lookups
CREATE INDEX idx_narrative_history_narrative ON public.narrative_history(narrative);