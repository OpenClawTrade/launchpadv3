
# Fix: Agent Payouts Calculation (Double-Counting Bug)

## Problem Identified

The "Agent Payouts" stat shows **14.66 SOL** but total system fees are only **11.06 SOL**. This is mathematically impossible.

**Root Cause:** The `fun-distribute` function increments `agents.total_fees_earned_sol` each time it processes claims, but due to batch grouping across multiple runs, the same fees get added to the running total multiple times.

| Agent | Stored Earned | Correct 80% Share | Difference |
|-------|---------------|-------------------|------------|
| TunaAI_Bmyigj | 10.40 SOL | 5.20 SOL | 2x over |
| TunaAI_F5TJYD | 3.84 SOL | 1.92 SOL | 2x over |
| TunaAI_HPHoEV | 0.37 SOL | 0.18 SOL | 2x over |

**Total Correct Agent Payouts: 7.33 SOL** (80% of agent token fees)

## Solution

Instead of relying on the corrupted `total_fees_earned_sol` column, calculate the agent payouts dynamically from the source of truth: `fun_fee_claims` table.

## Technical Changes

### File: `supabase/functions/agent-stats/index.ts`

Replace the corrupted column read with a proper calculation:

```text
CURRENT (Broken - lines 95-99):
─────────────────────────────────
const totalAgentPayouts = agents?.reduce(
  (sum, a) => sum + Number(a.total_fees_earned_sol || 0),
  0
) || 0;

NEW (Fixed):
─────────────────────────────────
// Calculate agent payouts from source of truth (fun_fee_claims)
// Agent share = 80% of claimed fees for agent-launched tokens
let totalAgentPayouts = 0;
if (agentTokenIds.length > 0) {
  const { data: agentFeeClaims } = await supabase
    .from("fun_fee_claims")
    .select("claimed_sol")
    .in("fun_token_id", agentTokenIds);

  const agentTokenFees = agentFeeClaims?.reduce(
    (sum, fc) => sum + Number(fc.claimed_sol || 0), 0
  ) || 0;

  // Agents get 80% of fees from their tokens
  totalAgentPayouts = agentTokenFees * 0.8;
}
```

This reuses the already-fetched `agentTokenIds` array and calculates the correct 80% share from actual fee claims.

## Expected Result

| Stat | Before Fix | After Fix |
|------|------------|-----------|
| Agent Payouts | 14.66 SOL | 7.33 SOL |
| Fees Claimed (System) | 11.06 SOL | 11.06 SOL |

**Math check:** 7.33 / 11.06 = 66% (correct, since agent tokens are ~80% of total volume and agents get 80% of that)

## Optional: Clean Up Corrupted Data

After fixing the calculation, we should also reset the corrupted `total_fees_earned_sol` values in the `agents` table to prevent confusion:

```sql
-- Reset and recalculate from source of truth
UPDATE agents a
SET total_fees_earned_sol = COALESCE((
  SELECT SUM(ffc.claimed_sol * 0.8)
  FROM fun_fee_claims ffc
  JOIN fun_tokens ft ON ffc.fun_token_id = ft.id
  WHERE ft.agent_id = a.id
), 0);
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/agent-stats/index.ts` | Calculate `totalAgentPayouts` from `fun_fee_claims` instead of corrupted column |

## Why This Fixes It

1. **Source of Truth**: Uses `fun_fee_claims` which is the actual record of collected fees
2. **No Double-Counting**: Each fee claim row is counted exactly once
3. **Correct Math**: Applies the 80% agent share properly
4. **No Running Totals**: Avoids corruption from incremental updates
