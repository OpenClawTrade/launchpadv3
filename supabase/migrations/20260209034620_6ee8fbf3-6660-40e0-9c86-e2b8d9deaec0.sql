-- Add subtuna_ticker column to x_bot_accounts for cross-posting to SubTuna
ALTER TABLE public.x_bot_accounts
ADD COLUMN subtuna_ticker TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.x_bot_accounts.subtuna_ticker IS 'Links this X account to a SubTuna community for synchronized posting';