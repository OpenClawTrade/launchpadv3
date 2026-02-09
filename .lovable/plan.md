

# Trading Agent Fixes - Agent 67 Activation

## Issues Found

### Critical Issues

1. **Trading Execution is FAILING** 
   - The `trading-agent-execute` function crashes with error: "Could not embed because more than one relationship was found for 'trading_agents' and 'agents'"
   - The Supabase query needs to explicitly specify the relationship

2. **No Trending Tokens Available**
   - The pump.fun API is returning HTTP 530 (origin errors)
   - The `pumpfun_trending_tokens` table is empty
   - No cron job is scheduled for `pumpfun-trending-sync`

3. **Position Sizing Not Capital-Aware**
   - Currently uses fixed percentage (15% for balanced strategy)
   - With 0.585 SOL capital, that's ~0.07 SOL after reserves - too small to trade
   - Need tiered sizing based on available capital:
     - Under 1 SOL: max 0.1 SOL per position
     - 1-2 SOL: max 0.25 SOL per position
     - Above 2 SOL: use percentage-based sizing

## Implementation Plan

### Step 1: Fix Trading Agent Query Relationship

Update `trading-agent-execute/index.ts` line 68:
```typescript
// FROM:
agent:agents(id, name, avatar_url)

// TO (explicit relationship):
agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url)
```

Also update `trading-agent-monitor/index.ts` line 87 with the same fix.

### Step 2: Implement Capital-Aware Position Sizing

Add tiered position sizing logic in `trading-agent-execute/index.ts`:

```typescript
// Capital tier-based position sizing
const CAPITAL_TIERS = {
  LOW: { maxCapital: 1.0, maxPositionSol: 0.1 },
  MEDIUM: { maxCapital: 2.0, maxPositionSol: 0.25 },
  HIGH: { maxCapital: Infinity, maxPositionSol: null }, // Use percentage
};

function calculatePositionSize(
  availableCapital: number, 
  strategyPct: number, 
  maxPositions: number,
  openPositions: number
): number {
  const baseSize = Math.min(
    availableCapital * (strategyPct / 100),
    availableCapital / (maxPositions - openPositions)
  );

  // Apply capital tier limits
  if (availableCapital < 1.0) {
    return Math.min(baseSize, 0.1);
  } else if (availableCapital < 2.0) {
    return Math.min(baseSize, 0.25);
  }
  
  return baseSize;
}
```

### Step 3: Fix pump.fun Data Source

The pump.fun API is currently blocked (530 errors). Options:
- Add fallback to DexScreener API for trending Solana tokens
- Add retry logic with exponential backoff
- Cache last known good data for 1 hour instead of deleting immediately

I'll implement a DexScreener fallback since pump.fun appears to be blocking requests.

### Step 4: Create Cron Job for Trending Sync

Add a pg_cron job to call `pumpfun-trending-sync` every 5 minutes (SQL insert required).

### Step 5: Lower Minimum Position Size

Update minimum position check from 0.1 SOL to 0.05 SOL to allow smaller trades while capital is low:

```typescript
// Line 156 in trading-agent-execute
if (positionSize < 0.05) {  // Changed from 0.1
  console.log(`Position size too small: ${positionSize}`);
  continue;
}
```

## Technical Details

| File | Change |
|------|--------|
| `trading-agent-execute/index.ts` | Fix query relationship, add tiered sizing, lower min position |
| `trading-agent-monitor/index.ts` | Fix query relationship |
| `pumpfun-trending-sync/index.ts` | Add DexScreener fallback for when pump.fun is blocked |
| Database | Insert cron job for trending sync |

## Agent 67 Status After Fix

| Metric | Current | After Fix |
|--------|---------|-----------|
| Status | Active | Active |
| Capital | 0.585 SOL | 0.585 SOL |
| Available | ~0.485 SOL (after gas reserve) | ~0.485 SOL |
| Max Position | 0.07 SOL (too small) | 0.1 SOL (capped by tier) |
| Min Position | 0.1 SOL | 0.05 SOL |
| Can Trade | No (size < min) | Yes |

