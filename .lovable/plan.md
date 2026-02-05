
# Fix EQM Trading Agent Token Linking

## Problem
The EQM trading agent was created successfully and its token launched on-chain (visible on Axiom with $4.7K market cap and trading activity), but the database linkages are broken:
- The token exists in `tokens` table but NOT in `fun_tokens`
- The `trading_agents` record has `mint_address: NULL` and `fun_token_id: NULL`
- Fee claiming doesn't work because `fun-claim-fees` only queries `fun_tokens`

## Solution Overview

### Step 1: Insert EQM into fun_tokens
Create a `fun_tokens` record linking to the existing on-chain token and trading agent.

**Data to insert:**
| Field | Value |
|-------|-------|
| name | Equilibrium |
| ticker | EQM |
| mint_address | `3AWXpAzsky7ZCwSkLRGyLhhmEMcE56GUeyh5Z2JwyqMV` |
| dbc_pool_address | `6TRwCoJxaP72QWMT9Zunv5m5fT9EkGJ3gakPqcMYiPm5` |
| status | active |
| agent_id | `1b1dc89e-1d93-4f4f-bb17-c70f6e194512` |
| trading_agent_id | `421ed8a7-422a-43c1-b6ec-41f458f26faa` |
| is_trading_agent_token | true |
| agent_fee_share_bps | 8000 (80% to agent) |

### Step 2: Update trading_agents record
Link the trading agent to its token.

**Updates:**
- `mint_address` → `3AWXpAzsky7ZCwSkLRGyLhhmEMcE56GUeyh5Z2JwyqMV`
- `fun_token_id` → (the new fun_tokens.id from Step 1)

### Step 3: Create SubTuna community
Create the community page so users can view and discuss the agent.

### Step 4: Update King of the Hill logic
Modify `useKingOfTheHill.ts` to include newly launched trading agent tokens, guaranteeing visibility even with low bonding progress.

---

## Technical Details

### Database Changes (SQL Migrations)

**Insert into fun_tokens:**
```sql
INSERT INTO fun_tokens (
  name, ticker, mint_address, dbc_pool_address, status,
  agent_id, trading_agent_id, is_trading_agent_token, agent_fee_share_bps,
  price_sol, market_cap_sol, bonding_progress
)
VALUES (
  'Equilibrium', 'EQM', '3AWXpAzsky7ZCwSkLRGyLhhmEMcE56GUeyh5Z2JwyqMV',
  '6TRwCoJxaP72QWMT9Zunv5m5fT9EkGJ3gakPqcMYiPm5', 'active',
  '1b1dc89e-1d93-4f4f-bb17-c70f6e194512', '421ed8a7-422a-43c1-b6ec-41f458f26faa',
  true, 8000, 0.00000003, 30, 0
)
RETURNING id;
```

**Update trading_agents:**
```sql
UPDATE trading_agents
SET 
  mint_address = '3AWXpAzsky7ZCwSkLRGyLhhmEMcE56GUeyh5Z2JwyqMV',
  fun_token_id = '<new_fun_token_id>'
WHERE id = '421ed8a7-422a-43c1-b6ec-41f458f26faa';
```

**Create SubTuna community:**
```sql
INSERT INTO subtuna (name, ticker, description, icon_url, agent_id, fun_token_id)
VALUES (
  'Equilibrium', 'EQM', 'Official community for Equilibrium - Autonomous Trading Agent',
  '<avatar_url_from_trading_agents>',
  '1b1dc89e-1d93-4f4f-bb17-c70f6e194512',
  '<new_fun_token_id>'
);
```

### Frontend Changes

**File: `src/hooks/useKingOfTheHill.ts`**

Update the query to include a "newly launched trading agent" slot in King of the Hill:

```typescript
// Modified fetchKingOfTheHill function
async function fetchKingOfTheHill(): Promise<KingToken[]> {
  // Fetch top 2 by bonding progress
  const { data: topTokens, error } = await supabase
    .from("fun_tokens")
    .select(`...`)
    .eq("status", "active")
    .order("bonding_progress", { ascending: false })
    .limit(3);

  // Fetch newest trading agent token (last 24 hours)
  const { data: newestTradingAgent } = await supabase
    .from("fun_tokens")
    .select(`...`)
    .eq("status", "active")
    .eq("is_trading_agent_token", true)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  // Merge: top tokens + newest trading agent (deduplicated)
  const merged = [...(topTokens || [])];
  if (newestTradingAgent?.[0]) {
    const exists = merged.some(t => t.id === newestTradingAgent[0].id);
    if (!exists) {
      merged.push(newestTradingAgent[0]);
    }
  }

  return filterHiddenTokens(merged.slice(0, 3));
}
```

---

## Outcome

After these changes:
1. EQM appears in the trading agents list with correct CA and link
2. Fee claiming starts working (next `fun-claim-fees` cron run)
3. Fees flow to the trading agent wallet (80% share)
4. Agent activates when 0.5 SOL threshold is reached
5. King of the Hill includes new trading agent tokens for 24 hours

## Files to Modify

| File | Change |
|------|--------|
| Database | Insert `fun_tokens` record, update `trading_agents`, create `subtuna` |
| `src/hooks/useKingOfTheHill.ts` | Add logic to include newest trading agent token |
