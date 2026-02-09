

# Fix: Trading Agent Not Executing (Cron Jobs Inactive)

## Root Cause

Both cron jobs that drive autonomous trading are **disabled** (`active: false`):
- Job 43 (`trading-agent-execute`, every 2 min) -- **INACTIVE**
- Job 44 (`trading-agent-monitor`, every 1 min) -- **INACTIVE**

The agent has capital (3.87 SOL), is marked "active", and has 0 open positions. It simply isn't being triggered.

## Fix

### Part 1: Re-enable cron jobs

Run a SQL migration to activate both cron jobs:

```sql
UPDATE cron.job SET active = true WHERE jobid IN (43, 44);
```

This immediately resumes the 2-minute execution cycle and 1-minute monitoring cycle.

### Part 2: Manually trigger execution to verify

After enabling cron, call the `trading-agent-execute` function once to confirm it picks up tokens and trades. This will also produce logs showing:
- How many DexScreener tokens were fetched
- How many passed scoring (score >= 60, liquidity >= 20 SOL)
- How many were filtered out by the re-buy prevention
- Whether AI chose to trade

## Current Token Pipeline Status

The trending data (`pumpfun_trending_tokens`) is stale (last synced ~1 hour ago), but this doesn't matter because the execute function now uses **live DexScreener discovery** -- it fetches fresh token profiles and boosts directly from DexScreener on each run, scores them inline, and picks tokens under 1 hour old with score >= 60 and liquidity >= 20 SOL.

## What Happens After the Fix

1. Cron fires `trading-agent-execute` every 2 minutes
2. Function fetches latest Solana tokens from DexScreener (profiles + boosts)
3. Scores them (liquidity, holders, age, narrative, volume)
4. Filters out the 1 previously traded token
5. AI analyzes top candidates and picks one
6. Executes Jupiter swap with Jito MEV protection
7. Places TP limit order on Jupiter Trigger API
8. Monitor cron checks SL via price polling every ~15 seconds

---

### Technical Details

**Database change:** Single SQL update to `cron.job` table to set `active = true` for jobs 43 and 44.

**No code changes required** -- all execution and monitoring logic is already deployed and functional. The issue is purely that the scheduler is turned off.

