

# Fix: King of the Hill Showing Stale Data (Mars vs Crusty Issue)

## Problem Summary

**Mars Ruled** (created Jan 31) appears as #1 in King of the Hill with 5.21% bonding progress, but this data is **stale** (last updated 8+ hours ago). **Crusty** (created today) shows 1.76% with fresh data, but the user reports Crusty actually has higher real activity.

### Root Cause

The `fun-pool-cache` edge function only updates the **50 newest tokens** (ordered by `created_at DESC`). Older tokens like Mars Ruled fall outside this window and stop receiving on-chain data updates, causing their `bonding_progress` values to become frozen at whatever level they reached when still being tracked.

| Token | Created | Last Updated | Progress | Problem |
|-------|---------|--------------|----------|---------|
| Mars Ruled | Jan 31 | 8+ hours ago | 5.21% | STALE - not in top 50 newest |
| Crusty | Feb 6 | 15 min ago | 1.76% | Fresh but lower due to comparison with stale data |

---

## Solution

Update `fun-pool-cache` to prioritize **top tokens by bonding progress** alongside newest tokens. This ensures King of the Hill candidates always have fresh data.

### File to Modify

`supabase/functions/fun-pool-cache/index.ts`

### Changes (Lines 196-201)

**Current Logic (Broken):**
```typescript
const { data: tokens, error } = await supabase
  .from('fun_tokens')
  .select('id, mint_address, dbc_pool_address, status, price_sol, price_24h_ago')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(50); // Only newest 50 - older leaders get stale!
```

**Fixed Logic:**
```typescript
// Fetch top 30 by bonding progress (ensures KOTH accuracy)
const { data: topProgressTokens, error: topError } = await supabase
  .from('fun_tokens')
  .select('id, mint_address, dbc_pool_address, status, price_sol, price_24h_ago')
  .eq('status', 'active')
  .order('bonding_progress', { ascending: false })
  .limit(30);

// Fetch newest 30 tokens (ensures new launches get updates)
const { data: newestTokens, error: newestError } = await supabase
  .from('fun_tokens')
  .select('id, mint_address, dbc_pool_address, status, price_sol, price_24h_ago')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(30);

if (topError || newestError) {
  console.error('[fun-pool-cache] Error fetching tokens:', topError || newestError);
  return new Response(JSON.stringify({ error: 'Failed to fetch tokens' }), {
    status: 500,
    headers: corsHeaders,
  });
}

// Deduplicate and merge (max ~60 unique tokens, often overlapping)
const tokensMap = new Map<string, typeof topProgressTokens[0]>();
for (const t of [...(topProgressTokens || []), ...(newestTokens || [])]) {
  tokensMap.set(t.id, t);
}
const tokens = Array.from(tokensMap.values());
```

---

## What This Fixes

| Before | After |
|--------|-------|
| Only newest 50 tokens updated | Top 30 by progress + newest 30 updated |
| Mars Ruled data frozen 8+ hours | Mars Ruled gets fresh on-chain data |
| KOTH shows stale rankings | KOTH reflects real activity |
| Old leaders never corrected | Leaders always have current data |

---

## Expected Outcome

After deployment:
1. Next cron run will fetch Mars Ruled's actual on-chain bonding progress
2. If Mars has less real activity than Crusty, their positions will swap
3. King of the Hill will always show tokens with fresh, accurate data

---

## Technical Notes

- Total tokens processed stays ~50-60 (overlap between sets reduces duplicates)
- No additional RPC load since we're reshuffling existing limit, not increasing it
- Immediate fix - no database migration needed

