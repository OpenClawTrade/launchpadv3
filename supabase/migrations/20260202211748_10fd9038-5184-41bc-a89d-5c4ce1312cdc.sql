-- Make creator_wallet nullable to support launches without wallet (claim via X login)
ALTER TABLE public.fun_tokens 
ALTER COLUMN creator_wallet DROP NOT NULL;

-- Add comment explaining the nullable behavior
COMMENT ON COLUMN public.fun_tokens.creator_wallet IS 'Solana wallet address for fee distribution. NULL when user launches without wallet - fees claimed via X login verification.';