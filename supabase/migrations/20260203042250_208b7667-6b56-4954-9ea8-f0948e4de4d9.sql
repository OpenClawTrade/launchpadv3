-- Add deployer_wallet column to fun_tokens table
-- This tracks the fresh wallet generated per-launch for on-chain deployment

ALTER TABLE fun_tokens 
ADD COLUMN deployer_wallet text;

-- Create index for efficient lookups
CREATE INDEX idx_fun_tokens_deployer_wallet 
ON fun_tokens(deployer_wallet);

-- Add documentation
COMMENT ON COLUMN fun_tokens.deployer_wallet IS 
'Fresh wallet generated and funded per-launch for on-chain deployment';