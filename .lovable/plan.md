

# Urgent Trading Agent Fix - Fast Execution & Retry Logic

## Critical Issues Found

| Issue | Current State | Risk |
|-------|---------------|------|
| **No monitor cron job** | Monitor function exists but ISN'T SCHEDULED | Positions won't auto-close on SL/TP |
| **Execute runs every 5 min** | Way too slow for meme coins | Missed entries, slow reactions |
| **DNS failures = total failure** | No retry with alternate endpoints | Agent can't trade during DNS issues |
| **Single Jupiter endpoint** | Only `quote-api.jup.ag` | No fallback when blocked |

## Implementation Plan

### Step 1: Create 1-Minute Monitor Cron Job

Add a `pg_cron` job to run `trading-agent-monitor` every minute. The function already has an internal 15-second polling loop that runs for 50 seconds, giving effective ~15-second monitoring.

```sql
SELECT cron.schedule(
  'trading-agent-monitor-1min',
  '* * * * *', -- every minute
  $$ SELECT net.http_post(...) $$
);
```

### Step 2: Increase Execute Frequency to Every 2 Minutes

Change the execute cron from 5 minutes to 2 minutes for faster entries:

```sql
-- Update existing job
SELECT cron.alter_job(31, schedule => '*/2 * * * *');
```

### Step 3: Add Retry Logic with Exponential Backoff

Update `executeJupiterSwapWithJito()` function to retry DNS failures:

```typescript
async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      // Exponential backoff: 500ms, 1s, 2s
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      console.warn(`[retry] Attempt ${attempt + 1} failed, retrying...`);
    }
  }
  throw new Error('All retries exhausted');
}
```

### Step 4: Add Multiple Jupiter API Endpoints

Add fallback endpoints for Jupiter API:

```typescript
const JUPITER_QUOTE_ENDPOINTS = [
  'https://quote-api.jup.ag/v6',
  'https://quote-api.jup.ag/v6', // Primary
  'https://lite-api.jup.ag/v6', // Lite endpoint
];

async function getJupiterQuote(inputMint, outputMint, amount, slippage) {
  for (const endpoint of JUPITER_QUOTE_ENDPOINTS) {
    try {
      const response = await fetchWithRetry(
        `${endpoint}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage}`
      );
      if (response.ok) return response.json();
    } catch (e) {
      console.warn(`[jupiter] Endpoint ${endpoint} failed, trying next...`);
    }
  }
  throw new Error('All Jupiter endpoints failed');
}
```

### Step 5: Apply Same Retry Logic to Monitor Function

Update `trading-agent-monitor/index.ts` with the same retry wrapper for Jupiter API calls.

## Technical Summary

| File | Changes |
|------|---------|
| `trading-agent-execute/index.ts` | Add `fetchWithRetry()`, multi-endpoint Jupiter support |
| `trading-agent-monitor/index.ts` | Add `fetchWithRetry()`, multi-endpoint Jupiter support |
| Database | Create monitor cron (1 min), update execute cron (2 min) |

## Expected Behavior After Fix

| Metric | Before | After |
|--------|--------|-------|
| **Position monitoring** | Manual only | Every 15 seconds (via 1-min cron with internal loop) |
| **New trade attempts** | Every 5 minutes | Every 2 minutes |
| **DNS failure handling** | Total failure | 3 retries with exponential backoff |
| **Jupiter API resilience** | Single endpoint | Multiple endpoints with fallback |

