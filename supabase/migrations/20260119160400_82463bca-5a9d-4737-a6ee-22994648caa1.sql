-- Create table to track launch attempts by IP
CREATE TABLE public.launch_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  launched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  token_id UUID REFERENCES public.tokens(id) ON DELETE SET NULL
);

-- Create index for fast IP lookups
CREATE INDEX idx_launch_rate_limits_ip_time ON public.launch_rate_limits (ip_address, launched_at DESC);

-- Enable RLS (but allow backend inserts via service role)
ALTER TABLE public.launch_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public read/write - only backend can access
CREATE POLICY "No public access to rate limits"
ON public.launch_rate_limits
FOR ALL
USING (false);

-- Auto-cleanup old records (older than 24 hours) via a function
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.launch_rate_limits
  WHERE launched_at < now() - INTERVAL '24 hours';
END;
$$;