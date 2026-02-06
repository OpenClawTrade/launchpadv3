-- =====================================================
-- TUNA Project - Cron Jobs Recreation Script
-- =====================================================
-- This script recreates all 22+ cron jobs for the TUNA platform
-- 
-- BEFORE RUNNING:
-- 1. Replace YOUR_SUPABASE_URL with your new project URL
-- 2. Replace YOUR_ANON_KEY with your new project's anon key
-- 3. Ensure pg_cron and pg_net extensions are enabled
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- CONFIGURATION - UPDATE THESE VALUES
-- =====================================================
-- Replace these placeholders with your actual values:
-- YOUR_SUPABASE_URL = https://YOUR_PROJECT_REF.supabase.co
-- YOUR_ANON_KEY = your new project's anon key from API settings

-- =====================================================
-- AGENT AUTOMATION CRON JOBS
-- =====================================================

-- Agent Auto-Engage (Every 5 minutes)
SELECT cron.schedule(
  'agent-auto-engage-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/agent-auto-engage',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Agent Auto-Engage (Every 15 minutes - backup)
SELECT cron.schedule(
  'agent-auto-engage-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/agent-auto-engage',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Agent Daily Post (12:00 UTC daily)
SELECT cron.schedule(
  'agent-daily-post',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/agent-hourly-post',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Agent Scan Mentions (Every 10 minutes)
SELECT cron.schedule(
  'agent-scan-mentions-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/agent-scan-mentions',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Agent Scan Twitter (Every 2 minutes)
SELECT cron.schedule(
  'agent-scan-twitter-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/agent-scan-twitter',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Agent Scan Twitter (Every minute)
SELECT cron.schedule(
  'agent-scan-twitter-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/agent-scan-twitter',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- TRENDING & ANALYTICS CRON JOBS
-- =====================================================

-- Calculate Trending Topics (Every 15 minutes)
SELECT cron.schedule(
  'calculate-trending-topics',
  '*/15 * * * *',
  $$SELECT public.calculate_trending_topics()$$
);

-- Dune Sync (Every 15 minutes)
SELECT cron.schedule(
  'dune-sync-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/dune-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- PumpFun Trending Sync (Every 3 minutes)
SELECT cron.schedule(
  'trending-sync-every-3-min',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/pumpfun-trending-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- PumpFun Data Sync (Every 5 minutes)
SELECT cron.schedule(
  'pumpfun-data-sync-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/pumpfun-data-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- FEE CLAIMING & DISTRIBUTION CRON JOBS
-- =====================================================

-- Fun Claim Fees (Every minute)
SELECT cron.schedule(
  'fun-claim-fees-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/fun-claim-fees',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Fun Distribute (Every minute)
SELECT cron.schedule(
  'fun-distribute-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/fun-distribute',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Fun Distribute (At :05 and :35 past the hour)
SELECT cron.schedule(
  'fun-distribute-30min',
  '5,35 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/fun-distribute',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"source": "cron-30min"}'::jsonb
  ) AS request_id;
  $$
);

-- Fun Holder Distribute (Every 5 minutes)
SELECT cron.schedule(
  'fun-holder-distribute-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/fun-holder-distribute',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Fun Pool Cache (Every minute)
SELECT cron.schedule(
  'fun-pool-cache-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/fun-pool-cache',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Pump Claim Fees (Every 5 minutes)
SELECT cron.schedule(
  'pump-claim-fees-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/pump-claim-fees',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- SNIPER CRON JOBS
-- =====================================================

-- Fun Sniper Sell (Every minute)
SELECT cron.schedule(
  'fun-sniper-sell-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/fun-sniper-sell',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- PROMOTIONAL MENTION CRON JOBS
-- =====================================================

-- Influencer List Reply (Every 10 minutes)
SELECT cron.schedule(
  'influencer-list-reply-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/influencer-list-reply',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Promo Mention Scan (Every 2 minutes)
SELECT cron.schedule(
  'promo-mention-scan-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/promo-mention-scan',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Promo Mention Reply (Every minute)
SELECT cron.schedule(
  'promo-mention-reply-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/promo-mention-reply',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- TRADING AGENT CRON JOBS
-- =====================================================

-- Trading Agent Monitor (Every minute)
SELECT cron.schedule(
  'trading-agent-monitor-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/trading-agent-monitor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Trading Agent Execute (Every 5 minutes)
SELECT cron.schedule(
  'trading-agent-execute-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/trading-agent-execute',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- After running all the above, verify jobs were created:
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;

-- To unschedule a job (if needed):
-- SELECT cron.unschedule('job-name-here');

-- =====================================================
-- SUMMARY OF CRON JOBS (22 total)
-- =====================================================
/*
| Job Name                        | Schedule       | Function                    |
|---------------------------------|----------------|------------------------------|
| agent-auto-engage-5min          | */5 * * * *    | agent-auto-engage            |
| agent-auto-engage-every-15-min  | */15 * * * *   | agent-auto-engage            |
| agent-daily-post                | 0 12 * * *     | agent-hourly-post            |
| agent-scan-mentions-10min       | */10 * * * *   | agent-scan-mentions          |
| agent-scan-twitter-2min         | */2 * * * *    | agent-scan-twitter           |
| agent-scan-twitter-every-minute | * * * * *      | agent-scan-twitter           |
| calculate-trending-topics       | */15 * * * *   | (database function)          |
| dune-sync-every-15-min          | */15 * * * *   | dune-sync                    |
| fun-claim-fees-every-minute     | * * * * *      | fun-claim-fees               |
| fun-distribute-30min            | 5,35 * * * *   | fun-distribute               |
| fun-distribute-every-minute     | * * * * *      | fun-distribute               |
| fun-holder-distribute-every-5-min| */5 * * * *   | fun-holder-distribute        |
| fun-pool-cache-every-minute     | * * * * *      | fun-pool-cache               |
| fun-sniper-sell-cron            | * * * * *      | fun-sniper-sell              |
| influencer-list-reply-10min     | */10 * * * *   | influencer-list-reply        |
| promo-mention-reply-1min        | * * * * *      | promo-mention-reply          |
| promo-mention-scan-2min         | */2 * * * *    | promo-mention-scan           |
| pump-claim-fees-every-5-min     | */5 * * * *    | pump-claim-fees              |
| pumpfun-data-sync-5min          | */5 * * * *    | pumpfun-data-sync            |
| trending-sync-every-3-min       | */3 * * * *    | pumpfun-trending-sync        |
| trading-agent-execute-5min      | */5 * * * *    | trading-agent-execute        |
| trading-agent-monitor-1min      | * * * * *      | trading-agent-monitor        |
*/
