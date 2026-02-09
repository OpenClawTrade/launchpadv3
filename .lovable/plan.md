

## On-Demand Token Discovery (No Background Sync)

### Current Problem
The `pumpfun-trending-sync` cron runs every 5 minutes continuously, even when no agent needs a token. This wastes API calls and, worse, fills the database with stale data that agents then buy from -- tokens that were "trending" 5 minutes ago may already be dumped.

### New Architecture

Instead of a separate background sync, the `trading-agent-execute` function itself will fetch fresh tokens from pump.fun **at the moment it needs one**, poll every 10 seconds until a qualifying token is found, then buy immediately.

```text
BEFORE (two separate systems):
  Cron (5min) --> pumpfun-trending-sync --> DB table --> Cron (2min) --> trading-agent-execute --> reads stale DB --> buys

AFTER (single on-demand flow):
  Cron (2min) --> trading-agent-execute --> fetches pump.fun LIVE --> scores --> buys fresh token
```

### Changes

#### 1. Modify `trading-agent-execute/index.ts`
- Remove the query to `pumpfun_trending_tokens` table (lines 203-209)
- Instead, add an inline loop that:
  - Fetches `https://frontend-api.pump.fun/coins?sort=bump_order&limit=100&includeNsfw=false` directly
  - Scores and filters tokens using the same NARRATIVES scoring logic (moved inline)
  - If qualifying tokens found (score >= 60, liquidity >= 20 SOL), proceed to AI analysis and buy
  - If NO qualifying tokens found, wait 10 seconds and retry
  - Max runtime: 50 seconds (to stay within Edge Function 60s limit), so up to ~5 retries
  - If pump.fun API is down (530 etc.), skip cycle entirely -- do NOT fall back to anything

#### 2. Modify `pumpfun-trending-sync/index.ts`
- Remove the DexScreener fallback entirely (lines 51-86)
- Keep the function but make it lightweight: it still syncs pump.fun data to the DB for display purposes on the frontend trending page
- But it is NO LONGER the source of trading decisions

#### 3. Remove the `trending-sync-every-3-min` cron job
- The trending sync cron can be reduced to once every 30 minutes (just for UI display), or removed entirely if trending display isn't needed
- The critical trading data now comes from live fetches inside execute

#### 4. Tighten SL polling in `trading-agent-monitor/index.ts`
- Change `POLL_INTERVAL_MS` from `15000` to `5000` (5 seconds)
- Change `MAX_RUNTIME_MS` to `55000` to fit more checks

### Technical Details

**In `trading-agent-execute`, the new inline fetch + poll loop:**
```text
for each active agent that needs a trade:
  attempt = 0
  while attempt < 5 and elapsed < 50s:
    fetch pump.fun API directly (fresh data)
    if API fails: break (skip this cycle)
    score all 100 tokens using NARRATIVES logic
    filter: score >= 60, liquidity >= 20 SOL
    exclude tokens agent already holds
    exclude tokens traded in last 5 min
    if qualifying tokens found:
      pass to AI for selection
      execute buy
      break
    else:
      wait 10 seconds
      attempt++
```

**Files to modify:**
- `supabase/functions/trading-agent-execute/index.ts` -- inline pump.fun fetch with 10s polling loop, remove DB dependency for token selection
- `supabase/functions/pumpfun-trending-sync/index.ts` -- remove DexScreener fallback, keep for UI display only
- `supabase/functions/trading-agent-monitor/index.ts` -- change polling from 15s to 5s

**No new files needed. No database changes needed.**

The cron job `trending-sync-every-3-min` should be reduced to every 30 minutes or removed via the SQL editor, since it's no longer needed for trading decisions.

