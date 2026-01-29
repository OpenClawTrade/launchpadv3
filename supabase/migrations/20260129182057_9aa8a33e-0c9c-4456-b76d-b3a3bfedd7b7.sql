-- Create debug_logs table for frontend log capture
CREATE TABLE public.debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  client_ip TEXT,
  logs JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert logs (rate limited in edge function)
CREATE POLICY "Anyone can insert debug logs"
ON public.debug_logs
FOR INSERT
WITH CHECK (true);

-- Only service role can read logs
CREATE POLICY "Service role can read debug logs"
ON public.debug_logs
FOR SELECT
USING (false);

-- Auto-cleanup old logs (older than 7 days)
CREATE INDEX idx_debug_logs_created_at ON public.debug_logs(created_at);

-- Function to cleanup old debug logs
CREATE OR REPLACE FUNCTION public.cleanup_old_debug_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.debug_logs
  WHERE created_at < now() - INTERVAL '7 days';
END;
$$;