
# Fix Agent Token Linking and Volume Display

## Summary
Two issues need to be addressed on the Agents page:
1. **Token Linking**: Agent tokens should link to their SubTuna community page (`/t/{TICKER}`) instead of the trade page (`/launchpad/{mintAddress}`)
2. **Total Volume Shows $0**: The volume is being fetched from `volume_24h_sol` which is always 0 - need to calculate actual volume from fee claims data

---

## Issue 1: Link Agent Tokens to SubTuna Pages

### Current Behavior
- `AgentTokenCard.tsx` links to `/launchpad/${token.mintAddress}` (trade page)
- `AgentTopTokens.tsx` also links to `/launchpad/${token.mintAddress}`

### Solution
Update both components to link to `/t/${token.ticker}` (SubTuna community page):

**Files to modify:**
- `src/components/agents/AgentTokenCard.tsx` - Change all 3 links (image, ticker, Trade button) to `/t/${token.ticker}`
- `src/components/agents/AgentTopTokens.tsx` - Change link to `/t/${token.ticker}`

---

## Issue 2: Total Volume Showing $0

### Root Cause
The `agent-stats` edge function calculates `totalVolume` from `fun_tokens.volume_24h_sol`, which is always 0 for these tokens.

### Solution
Calculate total volume from actual fee claim data. The trading fee is 1%, so:
- `Total Volume = Total Fees Claimed / 0.01`

From the database, `fun_fee_claims` shows ~1.83 SOL in total fees claimed for agent tokens, which means ~183 SOL in actual trading volume.

**File to modify:**
- `supabase/functions/agent-stats/index.ts` - Add query to sum `fun_fee_claims.claimed_sol` and calculate volume

---

## Technical Implementation

### Changes to AgentTokenCard.tsx (lines 62, 82, 126)
```tsx
// Change from:
<Link to={`/launchpad/${token.mintAddress}`}>

// Change to:
<Link to={`/t/${token.ticker}`}>
```

### Changes to AgentTopTokens.tsx (line 76)
```tsx
// Change from:
to={`/launchpad/${token.mintAddress}`}

// Change to:
to={`/t/${token.ticker}`}
```

### Changes to agent-stats/index.ts

Add a query to calculate total volume from fee claims:

```typescript
// After fetching agent tokens, get total fees claimed
const { data: feeClaims } = await supabase
  .from("fun_fee_claims")
  .select("claimed_sol")
  .in("fun_token_id", agentTokenIds);

const totalFeesClaimed = feeClaims?.reduce(
  (sum, fc) => sum + Number(fc.claimed_sol || 0), 0
) || 0;

// Volume = Fees / 1% fee rate
const totalVolume = totalFeesClaimed / 0.01;
```

---

## Files to Modify
1. `src/components/agents/AgentTokenCard.tsx` - Update 3 links to use `/t/{ticker}`
2. `src/components/agents/AgentTopTokens.tsx` - Update link to use `/t/{ticker}`  
3. `supabase/functions/agent-stats/index.ts` - Calculate volume from fee claims

---

## Expected Results
- Clicking any agent token navigates to `/t/ATUN` or `/t/TUNAKHAMU` (SubTuna community)
- Total Volume stat shows actual trading volume (~$27K based on ~183 SOL at current prices)
