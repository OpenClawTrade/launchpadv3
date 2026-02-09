-- Add tracked_keywords column for plain keyword searches (like "openclaw", "tuna")
ALTER TABLE x_bot_account_rules 
ADD COLUMN IF NOT EXISTS tracked_keywords text[] DEFAULT ARRAY[]::text[];

-- Add initial keywords for existing rules
UPDATE x_bot_account_rules 
SET tracked_keywords = ARRAY['openclaw', 'buildtuna', 'tunalaunch', 'moltbook']
WHERE tracked_keywords = ARRAY[]::text[] OR tracked_keywords IS NULL;