-- Disable Twitter auto-reply bot
SELECT cron.unschedule('twitter-auto-reply-every-minute');

-- Disable Twitter mention launcher bot  
SELECT cron.unschedule('twitter-mention-launcher-every-minute');