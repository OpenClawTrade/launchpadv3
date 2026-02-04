-- Create x_launch_events table for stage-by-stage launch diagnostics
-- This table tracks every step of the X/Twitter launch pipeline so we can pinpoint failures

CREATE TABLE public.x_launch_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'twitter',
  post_id TEXT NOT NULL,
  post_author TEXT,
  stage TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX idx_x_launch_events_post_id ON public.x_launch_events(post_id);
CREATE INDEX idx_x_launch_events_created_at ON public.x_launch_events(created_at DESC);
CREATE INDEX idx_x_launch_events_stage ON public.x_launch_events(stage);
CREATE INDEX idx_x_launch_events_success ON public.x_launch_events(success);

-- Enable RLS
ALTER TABLE public.x_launch_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for admin dashboard)
CREATE POLICY "Allow admins to read x_launch_events"
ON public.x_launch_events
FOR SELECT
USING (public.is_admin());

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Allow service role full access"
ON public.x_launch_events
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.x_launch_events IS 'Stage-by-stage logging for X/Twitter token launches to diagnose image upload and metadata issues';
COMMENT ON COLUMN public.x_launch_events.stage IS 'Pipeline stage: detected, command_validated, image_found, image_fetch_ok, image_upload_ok, create_token_ok, reply_sent, failed';
COMMENT ON COLUMN public.x_launch_events.details IS 'JSON with URLs, content-type, byte size, durations, mint address, etc.';