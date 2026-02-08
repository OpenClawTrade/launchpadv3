-- Add socks5_urls array column to store multiple proxies
ALTER TABLE public.x_bot_accounts 
ADD COLUMN IF NOT EXISTS socks5_urls text[] DEFAULT '{}';

-- Migrate existing proxy_url data to the new array column
UPDATE public.x_bot_accounts 
SET socks5_urls = ARRAY[proxy_url]
WHERE proxy_url IS NOT NULL AND proxy_url != '' AND (socks5_urls IS NULL OR array_length(socks5_urls, 1) IS NULL);

-- Add column to track which proxy index to try next
ALTER TABLE public.x_bot_accounts 
ADD COLUMN IF NOT EXISTS current_socks5_index integer DEFAULT 0;

-- Add column to track last proxy failure time
ALTER TABLE public.x_bot_accounts 
ADD COLUMN IF NOT EXISTS last_socks5_failure_at timestamptz;