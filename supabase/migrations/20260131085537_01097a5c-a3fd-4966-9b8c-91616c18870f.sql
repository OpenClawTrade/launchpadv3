-- Create visitor sessions table for tracking active users
CREATE TABLE public.visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying of recent sessions
CREATE INDEX idx_visitor_sessions_last_seen ON public.visitor_sessions (last_seen_at DESC);

-- Enable RLS
ALTER TABLE public.visitor_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/update their session (anonymous tracking)
CREATE POLICY "Anyone can upsert visitor sessions"
ON public.visitor_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Function to get active visitor count (last 15 minutes)
CREATE OR REPLACE FUNCTION public.get_active_visitors_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.visitor_sessions
  WHERE last_seen_at > now() - interval '15 minutes';
$$;

-- Function to cleanup old sessions (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_visitor_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.visitor_sessions
  WHERE last_seen_at < now() - interval '1 hour';
END;
$$;