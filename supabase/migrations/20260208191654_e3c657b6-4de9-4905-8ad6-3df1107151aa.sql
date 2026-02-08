-- Add last_scanned_at timestamp to track scan progress per account
ALTER TABLE public.x_bot_accounts
ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;