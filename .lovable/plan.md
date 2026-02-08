
# Optimize Twitter API Credit Usage

## Current Problem
The system is burning through Twitter API credits because:
1. **x-bot-scan** runs every minute (job 41) - searches for 4 mentions + 5 cashtags
2. **promo-mention-scan** runs every 2 minutes (job 30) - searches for 4 platform mentions
3. Each search API call consumes credits regardless of results
4. The `last_scanned_at` filter helps avoid duplicate processing but doesn't reduce API calls

## Optimization Strategy

### 1. Add Result Limiting to API Calls
Modify the `searchTweets` function to request only the 10 most recent results instead of the default (which can be 20-100+).

```text
searchUrl.searchParams.set("count", "10");  // Limit to 10 results
```

### 2. Reduce Scan Frequency
Change cron schedules to be more efficient:
- **x-bot-scan**: Every 5 minutes instead of every minute
- **promo-mention-scan**: Every 5 minutes instead of every 2 minutes

This alone reduces API calls by ~70-80%.

### 3. Consolidate Searches (Optional but Recommended)
Currently if you have 9 search terms (4 mentions + 5 cashtags), they're combined into ONE query using OR operators - so this is already efficient. No change needed here.

### 4. Skip Scan if Queue is Full
Add logic to skip scanning if there are already enough pending items in the queue (e.g., 5+ pending tweets). This prevents wasteful scans when the reply system is behind.

## Implementation Changes

### Files to Modify

**1. `supabase/functions/x-bot-scan/index.ts`**
- Add `count=10` parameter to limit API results
- Add queue-check to skip scan if queue already has 5+ pending items

**2. `supabase/functions/promo-mention-scan/index.ts`**  
- Add `count=10` parameter to limit API results
- Add queue-check to skip scan if queue already has 5+ pending items

**3. Database: Update Cron Schedules**
Run SQL to change scan frequency:
```sql
-- Change x-bot-scan from every minute to every 5 minutes
SELECT cron.alter_job(41, '*/5 * * * *');

-- Change promo-mention-scan from every 2 minutes to every 5 minutes  
SELECT cron.alter_job(30, '*/5 * * * *');
```

## Expected Credit Savings

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| x-bot-scan calls/hour | 60 | 12 | 80% |
| promo-mention-scan calls/hour | 30 | 12 | 60% |
| Results per call | ~20-50 | 10 | 50-80% |
| **Total API calls/day** | ~2,160 | ~576 | **73%** |

## Technical Details

The Twitter API `advanced_search` endpoint supports a `count` parameter. Combined with `queryType=Latest`, this ensures we get only the freshest 10 tweets, which is plenty for a 5-minute scan window.

The queue-check optimization adds a simple SELECT before the search:
```typescript
const { count } = await supabase
  .from("x_bot_account_queue")
  .select("id", { count: "exact", head: true })
  .eq("status", "pending");

if (count >= 5) {
  // Skip scan - queue is full enough
  return;
}
```
