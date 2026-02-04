
# Fix: Agent Fees Earned Shows $0

## Problem Summary

The "Agent Fees Earned" stat on the Agents page displays $0, and "Agent Posts" also shows 0. This is because these values are **hardcoded as placeholders** in the `agent-stats` edge function, with a comment indicating "expensive query removed."

**Current Code (lines 74-82):**
```typescript
const stats = {
  totalMarketCap,
  totalAgentFeesEarned: 0, // Placeholder - expensive query removed
  totalTokensLaunched,
  totalVolume: totalMarketCap * 10, // Rough estimate
  totalAgents: totalAgents || 0,
  totalAgentPosts: 0, // Placeholder - expensive query removed
  totalAgentPayouts,
};
```

## Root Cause Analysis

The queries were removed for performance, but the data is actually **very lightweight**:

| Table | Row Count | Query Impact |
|-------|-----------|--------------|
| `fun_fee_claims` | 356 rows | Trivial |
| `subtuna_posts` (is_agent_post=true) | 5,311 rows | Light |

**Expected Values:**
- Agent Fees Earned: **~8.58 SOL** (calculated from `fun_fee_claims` with 0.8 multiplier)
- Agent Posts: **5,311**

---

## Solution

Update `supabase/functions/agent-stats/index.ts` to calculate both stats using efficient queries.

### Changes to `agent-stats/index.ts`

**1. Add Agent Fees Calculation:**

Query `fun_fee_claims` for agent-launched tokens and apply the 80% agent share:

```typescript
// Get agent-launched token IDs (already fetched above)
const agentTokenIds = (agentLaunchedTokens || [])
  .map(t => t.id)
  .filter(Boolean);

// Sum claimed fees for agent tokens (lightweight: ~356 rows total)
let totalAgentFeesEarned = 0;
if (agentTokenIds.length > 0) {
  const { data: feeClaims } = await supabase
    .from("fun_fee_claims")
    .select("claimed_sol")
    .in("fun_token_id", agentTokenIds);
  
  totalAgentFeesEarned = (feeClaims || []).reduce(
    (sum, c) => sum + Number(c.claimed_sol || 0), 0
  ) * 0.8; // 80% goes to agents
}
```

**2. Add Agent Posts Count:**

```typescript
// Count agent posts (lightweight query with index on is_agent_post)
const { count: agentPostsCount } = await supabase
  .from("subtuna_posts")
  .select("id", { count: "exact", head: true })
  .eq("is_agent_post", true);

const totalAgentPosts = agentPostsCount || 0;
```

**3. Update Stats Object:**

```typescript
const stats = {
  totalMarketCap,
  totalAgentFeesEarned, // Now calculated dynamically
  totalTokensLaunched,
  totalVolume: totalMarketCap * 10,
  totalAgents: totalAgents || 0,
  totalAgentPosts, // Now calculated dynamically
  totalAgentPayouts,
};
```

### Technical Notes

- **Performance**: The existing 5-minute in-memory cache already protects against heavy query loads
- **Consistency**: Uses the same calculation logic as `agent-me` and `agent-heartbeat` (sum of `claimed_sol` × 0.8)
- **Accuracy**: Queries the `fun_fee_claims` table which is the documented source of truth for fee data

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/agent-stats/index.ts` | Replace placeholder values with actual queries for fees and posts |

---

## Expected Outcome

After deployment:
- "Agent Fees Earned" will show approximately **~$X** (8.58 SOL × current SOL price)
- "Agent Posts" will show **5,311**
- Stats will continue to be cached for 5 minutes to maintain performance
