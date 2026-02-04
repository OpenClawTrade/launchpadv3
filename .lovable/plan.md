
# Fix Agent Payouts Showing 0 on Main Page

## Problem
The "Agent Payouts" stat on the main page displays `0.00 SOL` because the backend edge function has this value hardcoded to 0 with a comment stating "expensive query removed".

## Root Cause
In `supabase/functions/agent-stats/index.ts` (line 64):
```typescript
totalAgentPayouts: 0, // Placeholder - expensive query removed
```

## Actual Data Available
The `agent_fee_distributions` table contains the real payout data:
- Current total: **15.96 SOL** in agent fee distributions
- This tracks all fees allocated to agents (80% of trading fees for agent-launched tokens)

## Solution
Add a simple SUM query to the `agent-stats` edge function to calculate the actual total agent payouts from the `agent_fee_distributions` table.

## Implementation

### File: `supabase/functions/agent-stats/index.ts`

**Changes:**
1. Add a query to sum all agent payouts from `agent_fee_distributions`
2. Replace the hardcoded `0` with the actual calculated value

**New query to add (after line 50):**
```typescript
// Get total agent payouts (simple SUM query)
const { data: agentPayoutsData, error: payoutsError } = await supabase
  .from("agent_fee_distributions")
  .select("amount_sol")
  .then(res => ({
    data: res.data?.reduce((sum, r) => sum + Number(r.amount_sol || 0), 0) || 0,
    error: res.error
  }));

// Or use a more efficient RPC call if available
```

**Alternative (more efficient):**
```typescript
const { data: payoutsSum } = await supabase.rpc('sum_agent_payouts');
```

**Update stats object:**
```typescript
const stats = {
  totalMarketCap,
  totalAgentFeesEarned: 0,
  totalTokensLaunched,
  totalVolume: totalMarketCap * 10,
  totalAgents: totalAgents || 0,
  totalAgentPosts: 0,
  totalAgentPayouts: agentPayoutsTotal || 0, // Use actual data
};
```

## Technical Details

### Query Efficiency
The SUM query on `agent_fee_distributions` is lightweight:
- Table has only ~239 rows currently
- Single column aggregation (amount_sol)
- No JOINs required
- Result is cached for 5 minutes by the existing caching mechanism

### Implementation Approach
Use Supabase's built-in aggregation to minimize data transfer:
```typescript
// Fetch sum directly instead of all rows
const { data: payoutRows } = await supabase
  .from("agent_fee_distributions")
  .select("amount_sol");

const totalAgentPayouts = payoutRows?.reduce(
  (sum, r) => sum + Number(r.amount_sol || 0), 
  0
) || 0;
```

## Files to Modify
- `supabase/functions/agent-stats/index.ts` - Add query and update stats object

## Expected Result
After implementation, the main page stats will show:
- **Agent Payouts: ~15.96 SOL** (current value)
- Value updates as more agent fees are distributed
- 5-minute cache prevents excessive database queries
