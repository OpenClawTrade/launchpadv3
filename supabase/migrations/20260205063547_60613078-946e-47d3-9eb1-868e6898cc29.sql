-- Phase 1: Add mint_address and twitter_url columns to trading_agents
ALTER TABLE trading_agents 
ADD COLUMN IF NOT EXISTS mint_address TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT;

-- Add index for mint_address lookups
CREATE INDEX IF NOT EXISTS idx_trading_agents_mint_address ON trading_agents(mint_address) WHERE mint_address IS NOT NULL;