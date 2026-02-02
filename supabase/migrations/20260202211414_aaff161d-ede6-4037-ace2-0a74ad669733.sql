-- Make wallet_address nullable to support launches without wallet (claim via X login)
ALTER TABLE public.agent_social_posts 
ALTER COLUMN wallet_address DROP NOT NULL;

-- Add comment explaining the nullable behavior
COMMENT ON COLUMN public.agent_social_posts.wallet_address IS 'Solana wallet address for fee distribution. NULL when user launches without wallet - fees claimed via X login verification.';