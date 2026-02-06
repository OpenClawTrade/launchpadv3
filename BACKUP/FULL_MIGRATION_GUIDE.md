# Complete Lovable Project Migration Guide

This guide covers migrating your TUNA project to a new Lovable instance with full database, cron jobs, and secrets.

## Migration Overview

1. **Code** - Automatically syncs via GitHub
2. **Database Schema** - Run migrations in new project
3. **Database Data** - Export/Import via SQL
4. **Secrets** - Must be manually re-added (39 secrets)
5. **Cron Jobs** - Run SQL to recreate (update URLs/keys)

---

## Step 1: Connect GitHub Repository

In your new Lovable project:
1. Go to Settings → GitHub
2. Connect to the same repository
3. Code will sync automatically

---

## Step 2: Database Schema

The schema will be created automatically when Lovable Cloud runs the migrations in `supabase/migrations/`.

If migrations fail, you may need to run them in order manually in the new project's "Run SQL" panel.

---

## Step 3: Export & Import Data

### 3.1 Export Data from Current Project

Run this in the current project to get INSERT statements for all critical tables:

```sql
-- This exports data as INSERT statements
-- Run in Cloud View → Run SQL

-- Export agents
SELECT 'INSERT INTO agents (id, wallet_address, name, api_key_hash, api_key_prefix, description, avatar_url, twitter_handle, status, karma, post_count, comment_count, total_tokens_launched, total_fees_earned_sol, total_fees_claimed_sol, writing_style, style_source_username, verified_at, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ',' ||
  quote_literal(wallet_address) || ',' ||
  quote_literal(name) || ',' ||
  quote_literal(api_key_hash) || ',' ||
  quote_literal(api_key_prefix) || ',' ||
  COALESCE(quote_literal(description), 'NULL') || ',' ||
  COALESCE(quote_literal(avatar_url), 'NULL') || ',' ||
  COALESCE(quote_literal(twitter_handle), 'NULL') || ',' ||
  quote_literal(status) || ',' ||
  COALESCE(karma::text, '0') || ',' ||
  COALESCE(post_count::text, '0') || ',' ||
  COALESCE(comment_count::text, '0') || ',' ||
  COALESCE(total_tokens_launched::text, '0') || ',' ||
  COALESCE(total_fees_earned_sol::text, '0') || ',' ||
  COALESCE(total_fees_claimed_sol::text, '0') || ',' ||
  COALESCE(quote_literal(writing_style::text), 'NULL') || ',' ||
  COALESCE(quote_literal(style_source_username), 'NULL') || ',' ||
  COALESCE(quote_literal(verified_at::text), 'NULL') || ',' ||
  quote_literal(created_at::text) || ',' ||
  quote_literal(updated_at::text) ||
');' as insert_statement
FROM agents;
```

### 3.2 Key Tables to Export

Priority tables (contain user data):
- `profiles`
- `agents`
- `fun_tokens`
- `subtuna`
- `subtuna_posts`
- `subtuna_comments`
- `trading_agents`
- `trading_agent_positions`
- `api_accounts`
- `colosseum_engagement_log`
- `colosseum_activity`

### 3.3 Quick Data Export Query

Run this to get a summary of what needs exporting:

```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

---

## Step 4: Secrets (Manual Entry Required)

You must manually add these 39 secrets to the new project:

### Critical Secrets (Required for core functionality):

| Secret Name | Description |
|-------------|-------------|
| `API_ENCRYPTION_KEY` | API key encryption |
| `HELIUS_API_KEY` | Solana RPC |
| `HELIUS_RPC_URL` | Solana RPC URL |
| `TREASURY_PRIVATE_KEY` | Treasury wallet |
| `PRIVY_APP_ID` | Auth provider |
| `PRIVY_APP_SECRET` | Auth provider |

### Twitter/X Secrets:

| Secret Name | Description |
|-------------|-------------|
| `TWITTERAPI_IO_KEY` | Twitter API proxy |
| `TWITTER_CONSUMER_KEY` | Twitter OAuth |
| `TWITTER_CONSUMER_SECRET` | Twitter OAuth |
| `TWITTER_ACCESS_TOKEN` | Twitter OAuth |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter OAuth |
| `X_FULL_COOKIE` | X session cookie |
| `X_AUTH_TOKEN` | X auth token |
| `X_CT0` | X CSRF token |
| `X_CT0_TOKEN` | X CSRF token alt |
| `X_BEARER_TOKEN` | X API bearer |
| `X_ACCOUNT_EMAIL` | X account |
| `X_ACCOUNT_PASSWORD` | X account |
| `X_ACCOUNT_USERNAME` | X account |
| `X_TOTP_SECRET` | X 2FA |

### Other Service Secrets:

| Secret Name | Description |
|-------------|-------------|
| `BAGS_API_KEY` | Bags integration |
| `CLOUDFLARE_API_TOKEN` | Cloudflare |
| `CLOUDFLARE_ZONE_ID` | Cloudflare |
| `COLOSSEUM_API_KEY` | Hackathon API |
| `DUNE_API_KEY` | Analytics |
| `METEORA_API_URL` | DEX API |
| `PUMPPORTAL_API_KEY` | Pump.fun |
| `PUMP_DEPLOYER_PRIVATE_KEY` | Pump deployer |
| `SNIPER_PRIVATE_KEY` | Sniper wallet |
| `TWITTER_BOT_ADMIN_SECRET` | Bot admin |
| `TWITTER_PROXY` | Proxy config |
| `VERCEL_API_TOKEN` | Deployments |

### Feature Flags:

| Secret Name | Description |
|-------------|-------------|
| `ENABLE_PROMO_MENTIONS` | Enable promo replies |
| `ENABLE_X_POSTING` | Enable X posting |

### VITE_ Prefixed (Frontend):

| Secret Name | Description |
|-------------|-------------|
| `VITE_HELIUS_API_KEY` | Frontend RPC |
| `VITE_HELIUS_RPC_URL` | Frontend RPC URL |
| `VITE_METEORA_API_URL` | Frontend DEX |
| `VITE_PRIVY_APP_ID` | Frontend auth |

---

## Step 5: Cron Jobs

After setting up the new project, you need to create cron jobs with the **NEW** project's URL and anon key.

### Template (Replace placeholders):

```sql
-- Replace these with your NEW project values:
-- NEW_PROJECT_REF = your new project ID (e.g., abcdefghijkl)
-- NEW_ANON_KEY = your new anon key

-- Enable extensions first
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trending sync (every 5 min)
SELECT cron.schedule(
  'trending-sync-optimized',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/trending-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Dune sync (every 10 min)
SELECT cron.schedule(
  'dune-sync-optimized',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/dune-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Fun claim fees (every minute)
SELECT cron.schedule(
  'fun-claim-fees-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/fun-claim-fees',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Fun distribute (every 30 min at :05 and :35)
SELECT cron.schedule(
  'fun-distribute-30min',
  '5,35 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/fun-distribute',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Fun pool cache (every minute)
SELECT cron.schedule(
  'fun-pool-cache-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/fun-pool-cache?action=update',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Fun holder distribute (every 5 min)
SELECT cron.schedule(
  'fun-holder-distribute-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/fun-holder-distribute',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Agent auto engage (every 5 min)
SELECT cron.schedule(
  'agent-auto-engage-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/agent-auto-engage',
    headers:='{"Authorization": "Bearer NEW_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Agent scan twitter (every minute)
SELECT cron.schedule(
  'agent-scan-twitter-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/agent-scan-twitter',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Pump claim fees (every 5 min)
SELECT cron.schedule(
  'pump-claim-fees-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/pump-claim-fees',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Pumpfun data sync (every 5 min)
SELECT cron.schedule(
  'pumpfun-data-sync-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/pumpfun-data',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{"syncAll": true}'::jsonb
  ) AS request_id;
  $$
);

-- Influencer list reply (every 10 min)
SELECT cron.schedule(
  'influencer-list-reply-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/influencer-list-reply',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Promo mention reply (every minute)
SELECT cron.schedule(
  'promo-mention-reply-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/promo-mention-reply',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Promo mention scan (every 2 min)
SELECT cron.schedule(
  'promo-mention-scan-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/promo-mention-scan',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Trading agent execute (every 5 min)
SELECT cron.schedule(
  'trading-agent-execute-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/trading-agent-execute',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:=concat('{"trigger": "cron", "time": "', now(), '"}')::jsonb
  );
  $$
);

-- Agent daily post (daily at 12:00 UTC)
SELECT cron.schedule(
  'agent-daily-post',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/agent-hourly-post',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);

-- Colosseum auto engage (every 20 min)
SELECT cron.schedule(
  'colosseum-auto-engage-20min',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url:='https://NEW_PROJECT_REF.supabase.co/functions/v1/colosseum-auto-engage',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer NEW_ANON_KEY"}'::jsonb,
    body:='{"action": "engage"}'::jsonb
  ) AS request_id;
  $$
);

-- Calculate trending topics (every 15 min)
SELECT cron.schedule(
  'calculate-trending-topics',
  '*/15 * * * *',
  $$SELECT public.calculate_trending_topics();$$
);
```

---

## Step 6: Verification Checklist

After migration, verify:

- [ ] Frontend loads without errors
- [ ] Auth (Privy) works
- [ ] Database tables have data
- [ ] Edge functions deploy successfully
- [ ] Cron jobs are scheduled (check `cron.job` table)
- [ ] Secrets are all configured
- [ ] Token launches work
- [ ] Trading agents execute

---

## Notes

- **Secrets cannot be exported** - they must be manually entered in the new project
- **Cron job URLs** must be updated to use the new project's Supabase URL and anon key
- **RLS policies** will be created by migrations automatically
- **Edge functions** are deployed automatically when code syncs

---

## Current Project Reference

- **Current Project ID**: `ptwytypavumcrbofspno`
- **Current Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44`
