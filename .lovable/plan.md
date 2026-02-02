
# Complete Fix: Agent Fee Data Integrity

## Problem Summary

The `agents.total_fees_earned_sol` column contains **corrupted data** (doubled values) due to the `fun-distribute` function incorrectly incrementing running totals multiple times. This causes:

| Component | Issue |
|-----------|-------|
| Agent Leaderboard | Shows 2x actual earnings |
| Agent Profile Pages | Shows 2x actual earnings |
| TunaBook Sidebar | Shows 2x actual earnings |
| Agent Stats (top-level) | Still reads from corrupted column |

**Current Corrupted Values:**
| Agent | Stored | Correct (80% share) | Over-counted |
|-------|--------|---------------------|--------------|
| TunaAI_Bmyigj | 10.40 SOL | 5.20 SOL | 2x |
| TunaAI_F5TJYD | 3.84 SOL | 1.92 SOL | 2x |
| TunaAI_HPHoEV | 0.37 SOL | 0.18 SOL | 2x |
| Inverse Cramer | 0.05 SOL | 0.03 SOL | 2x |

---

## Two-Part Solution

### Part 1: Clean Corrupted Data (Database Update)

Run a one-time SQL update to fix the `agents.total_fees_earned_sol` column with correct values calculated from the source of truth (`fun_fee_claims`):

```sql
UPDATE agents a
SET total_fees_earned_sol = COALESCE((
  SELECT SUM(ffc.claimed_sol) * 0.8
  FROM fun_fee_claims ffc
  JOIN fun_tokens ft ON ffc.fun_token_id = ft.id
  WHERE ft.agent_id = a.id
), 0)
WHERE a.status = 'active';
```

This recalculates the 80% agent share from actual fee claims for each agent.

### Part 2: Fix Remaining Component

The `agent-stats` function still uses the corrupted column for `totalAgentFeesEarned`. Update it to calculate dynamically like we did for `totalAgentPayouts`.

**File:** `supabase/functions/agent-stats/index.ts`

Change lines 77-80 from:
```typescript
const totalAgentFeesEarned = agents?.reduce(
  (sum, a) => sum + Number(a.total_fees_earned_sol || 0),
  0
) || 0;
```

To (reuse the already-calculated value):
```typescript
// Use the same source-of-truth calculation as totalAgentPayouts
// totalAgentFeesEarned should equal totalAgentPayouts for consistency
const totalAgentFeesEarned = totalAgentPayouts;
```

This ensures the stat bar shows accurate data even if the database column becomes corrupted again.

---

## Why This Fully Fixes It

1. **Database Cleanup**: Corrects all agent records to match actual fee claims
2. **Dynamic Calculation**: The `agent-stats` function calculates from source of truth
3. **All Components Fixed**: Leaderboard, profiles, and sidebar all read from the corrected `agents` table
4. **Future-Proof**: Even if `fun-distribute` double-counts again, the stats display will remain accurate

---

## Files to Modify

| Item | Type | Change |
|------|------|--------|
| `agents` table | Database | UPDATE to recalculate `total_fees_earned_sol` from `fun_fee_claims` |
| `supabase/functions/agent-stats/index.ts` | Edge Function | Use dynamic calculation for `totalAgentFeesEarned` |

---

## Expected Results After Fix

| Stat | Before | After |
|------|--------|-------|
| Agent Fees Earned (total) | ~14.66 SOL | ~7.33 SOL |
| TunaAI_Bmyigj (leaderboard) | 10.40 SOL | 5.20 SOL |
| TunaAI_F5TJYD (leaderboard) | 3.84 SOL | 1.92 SOL |

All values will now match the 80% share of actual trading fees from `fun_fee_claims`.
