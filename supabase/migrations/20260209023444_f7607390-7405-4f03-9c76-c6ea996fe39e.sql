-- Add author_cooldown_minutes column (replacing hours with minutes for finer control)
ALTER TABLE x_bot_account_rules 
ADD COLUMN IF NOT EXISTS author_cooldown_minutes integer DEFAULT 10;

-- Migrate existing data: convert hours to minutes
UPDATE x_bot_account_rules 
SET author_cooldown_minutes = COALESCE(author_cooldown_hours, 6) * 60
WHERE author_cooldown_minutes IS NULL OR author_cooldown_minutes = 10;

-- Set the requested 10 minute cooldown for all rules
UPDATE x_bot_account_rules SET author_cooldown_minutes = 10;