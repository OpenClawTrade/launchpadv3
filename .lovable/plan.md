
# Fix: Fee Claims Not Processing for New Tokens (CRUST Issue)

## Problem Summary

CRUST and other newly launched tokens are not having their fees claimed despite having significant trading volume (3% bonding progress means ~2.6 SOL in trades).

### Root Cause Analysis

**Two interconnected issues discovered:**

1. **Token Ordering Bug (Immediate Problem)**
   - The `fun-claim-fees` job processes only the **top 100 tokens** ordered by `volume_24h_sol DESC`
   - There are **271 active tokens** but only 100 get processed per run
   - CRUST is **ranked #271** (dead last) because all tokens have `volume_24h_sol = 0`
   - When all values are 0, PostgreSQL uses internal row order (oldest tokens first)

2. **Volume Not Being Tracked (Underlying Cause)**
   - The `volume_24h_sol` column in `fun_tokens` is **never updated**
   - Swap execution only updates the legacy `tokens` table via `backend_update_token_state`
   - The `fun_tokens` table has no corresponding volume update logic

---

## Solution

### Fix 1: Immediate — Update Ordering Logic (Priority)

Change the claim job to prioritize by `bonding_progress` instead of broken `volume_24h_sol`:

```text
File: supabase/functions/fun-claim-fees/index.ts

Change line 36:
FROM: .order("volume_24h_sol", { ascending: false, nullsFirst: false })
TO:   .order("bonding_progress", { ascending: false, nullsFirst: false })
```

**Rationale:** 
- `bonding_progress` directly reflects trading activity (it increases with each trade)
- CRUST would immediately jump from #271 to #2 in priority
- No schema changes required

### Fix 2: Add Secondary Ordering by Age

For tokens with equal progress, prioritize newest first:

```typescript
.order("bonding_progress", { ascending: false, nullsFirst: false })
.order("created_at", { ascending: false })
```

This ensures:
- Active tokens (high progress) processed first
- Among tokens with similar activity, newest get attention
- Old inactive tokens don't clog the queue

### Fix 3: Future Enhancement — Track Volume Properly (Optional)

Create a database trigger or update the swap logic to populate `volume_24h_sol`:

```sql
-- Option A: Create update function for fun_tokens
CREATE OR REPLACE FUNCTION backend_update_fun_token_volume(
  p_token_id UUID,
  p_volume_sol NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE fun_tokens 
  SET volume_24h_sol = COALESCE(volume_24h_sol, 0) + p_volume_sol,
      updated_at = NOW()
  WHERE id = p_token_id;
END;
$$ LANGUAGE plpgsql;
```

*This is optional since Fix 1 solves the immediate problem.*

---

## Implementation Steps

1. **Update `fun-claim-fees/index.ts`** — Change ordering from `volume_24h_sol` to `bonding_progress`
2. **Deploy edge function** — Automatic on next build
3. **Verify** — Monitor logs to confirm CRUST and other active tokens are now processed

---

## Expected Outcome

| Before | After |
|--------|-------|
| CRUST ranked #271, never processed | CRUST ranked #2, processed immediately |
| Active tokens may be skipped | Active tokens prioritized by actual trading |
| 0 claims on new tokens | Claims start accumulating |

---

## Technical Details

### Current Query (Broken)
```typescript
const { data: funTokens } = await supabase
  .from("fun_tokens")
  .select("*")
  .eq("status", "active")
  .eq("chain", "solana")
  .not("dbc_pool_address", "is", null)
  .order("volume_24h_sol", { ascending: false, nullsFirst: false }) // Always 0!
  .limit(100);
```

### Fixed Query
```typescript
const { data: funTokens } = await supabase
  .from("fun_tokens")
  .select("*")
  .eq("status", "active")
  .eq("chain", "solana")
  .not("dbc_pool_address", "is", null)
  .order("bonding_progress", { ascending: false, nullsFirst: false })
  .order("created_at", { ascending: false })
  .limit(100);
```

This single-line change fixes the immediate problem by ensuring tokens with actual trading activity (reflected in their bonding progress) are prioritized for fee claiming.
