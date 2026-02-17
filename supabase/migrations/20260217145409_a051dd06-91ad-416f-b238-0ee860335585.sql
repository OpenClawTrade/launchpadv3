-- Set up pg_cron job to auto-invoke vanity-cron every minute
SELECT cron.schedule(
  'vanity-cron-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://ptwytypavumcrbofspno.supabase.co/functions/v1/vanity-cron',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44"}'::jsonb,
    body:='{"time": "now"}'::jsonb
  ) AS request_id;
  $$
);