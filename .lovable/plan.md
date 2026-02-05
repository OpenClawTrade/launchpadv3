
# Fix: Trading Agent Profile Page "Not Found" Error

## Problem Identified
The Trading Agent Profile page shows "Not Found" because the Supabase query uses an **inner join** (`!` syntax) on the `agents` table. Since the Equilibrium trading agent has `agent_id = NULL`, the inner join returns no results.

**Current query (line 104):**
```typescript
agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url, karma)
```

The `!` forces an inner join, meaning if `agent_id` is NULL, no row is returned.

---

## Solution
Change the query to use a **left join** by removing the `!` syntax:

**File: `src/hooks/useTradingAgents.ts`**

```typescript
// Change from:
agent:agents!trading_agents_agent_id_fkey(id, name, avatar_url, karma)

// Change to:
agent:agents(id, name, avatar_url, karma)
```

This allows the query to return the trading agent even when `agent_id` is NULL, with `agent` being null in the response.

---

## Additional Consideration
The `TradingAgentProfilePage.tsx` already handles `agent` being undefined in many places (e.g., `agent?.agent?.name`), so no additional changes should be needed there. The page will display the trading agent's own data (name, ticker, avatar_url) from the `trading_agents` table regardless of whether an associated AI agent exists.

---

## Files to Modify
1. **`src/hooks/useTradingAgents.ts`** - Line 104: Remove `!` from the agents join

## Technical Note
The same pattern is used in `useTradingAgentLeaderboard` (line 160) and `useTradingAgents` list endpoint. These should also be updated for consistency, though they may work differently since they filter by `status: 'active'`.
