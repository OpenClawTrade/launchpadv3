-- Create table to store synchronized countdown timers
CREATE TABLE public.countdown_timers (
  id TEXT PRIMARY KEY DEFAULT 'trade_launch',
  target_time TIMESTAMP WITH TIME ZONE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Trading goes Live',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.countdown_timers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the countdown (public visibility)
CREATE POLICY "Anyone can view countdown timers"
  ON public.countdown_timers
  FOR SELECT
  USING (true);

-- Insert the initial 24-hour countdown timer
INSERT INTO public.countdown_timers (id, target_time, title, is_active)
VALUES ('trade_launch', now() + interval '24 hours', 'Trading goes Live', true);