-- Add launchpad type to distinguish token platforms
ALTER TABLE fun_tokens 
ADD COLUMN IF NOT EXISTS launchpad_type text DEFAULT 'tuna';

-- Add pump.fun specific fields
ALTER TABLE fun_tokens
ADD COLUMN IF NOT EXISTS pumpfun_bonding_curve text,
ADD COLUMN IF NOT EXISTS pumpfun_creator text,
ADD COLUMN IF NOT EXISTS pumpfun_signature text;

-- Add comment for documentation
COMMENT ON COLUMN fun_tokens.launchpad_type IS 'Platform: tuna or pumpfun';