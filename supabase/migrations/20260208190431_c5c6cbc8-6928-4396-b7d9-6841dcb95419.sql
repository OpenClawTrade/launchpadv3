-- Create x_bot_account_logs table for process activity logging
CREATE TABLE public.x_bot_account_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.x_bot_accounts(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('login', 'scan', 'match', 'reply', 'error', 'skip')),
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying by account and time
CREATE INDEX idx_x_bot_account_logs_account_created ON public.x_bot_account_logs(account_id, created_at DESC);

-- Create index for cleanup queries
CREATE INDEX idx_x_bot_account_logs_created_at ON public.x_bot_account_logs(created_at);

-- Enable RLS
ALTER TABLE public.x_bot_account_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "Service role has full access to logs"
  ON public.x_bot_account_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.x_bot_account_logs IS 'Activity logs for X-Bot accounts tracking scans, matches, replies, and errors';