
-- Update the influencer list reply cron to run every 30 minutes
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE '%influencer-list-reply%';

SELECT cron.schedule(
  'influencer-list-reply-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ptwytypavumcrbofspno.supabase.co/functions/v1/influencer-list-reply',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Update config interval
UPDATE public.influencer_list_config SET reply_interval_minutes = 30 WHERE is_active = true;
