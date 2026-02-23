

## Problem Analysis

The "Insufficient treasury balance" error occurs because:

1. **Two different treasury wallets**: Fee claims from Meteora pools go into the `TREASURY_PRIVATE_KEY` wallet (`HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx`), but creator payouts use `CLAW_TREASURY_PRIVATE_KEY` -- a different wallet that has no funds.

2. **Inflated earnings calculation**: The edge function uses `fun_tokens.total_fees_earned` (which may be stale/inflated) instead of `fun_fee_claims.claimed_sol` (actual on-chain claims that represent real money in the treasury).

3. **No safety cap**: If data is corrupted, the function could try to send more SOL than was ever actually collected.

## Plan

### 1. Fix treasury wallet mismatch

Change `claw-creator-claim` edge function to use `TREASURY_PRIVATE_KEY` (the wallet that actually received the claimed fees) instead of `CLAW_TREASURY_PRIVATE_KEY`.

### 2. Use `fun_fee_claims` as the source of truth (not `total_fees_earned`)

Replace the earnings calculation:
- **Before**: `earned = fun_tokens.total_fees_earned * 0.3` (could be inflated)  
- **After**: `earned = SUM(fun_fee_claims.claimed_sol) * 0.3` (actual on-chain claimed fees = real money)

This matches the pattern already used in the original `agent-creator-claim` function.

### 3. Add safety caps

- Add a per-claim maximum (e.g., 5 SOL cap) to prevent draining the treasury from a single bad claim
- Ensure the treasury balance check has adequate buffer (at least 0.05 SOL reserved for rent/fees)
- Log the treasury balance alongside claim amounts for auditing

### 4. UI: Show accurate amounts from the `checkOnly` response

The frontend should prefer the `checkOnly` API response values (which come from the corrected server-side calculation) over the locally-computed totals from `total_fees_earned`.

### Technical Details

**File: `supabase/functions/claw-creator-claim/index.ts`**

Changes to the earnings calculation section (~lines 98-128):

```text
Replace total_fees_earned lookup with:
  SELECT fun_token_id, SUM(claimed_sol) 
  FROM fun_fee_claims 
  WHERE fun_token_id IN (targetTokenIds)
  GROUP BY fun_token_id

earned_per_token = claimed_sol_sum * CREATOR_SHARE (0.3)
```

Change treasury key from `CLAW_TREASURY_PRIVATE_KEY` to `TREASURY_PRIVATE_KEY` (line 37).

Add safety cap:

```text
const MAX_SINGLE_CLAIM_SOL = 5.0;
if (claimable > MAX_SINGLE_CLAIM_SOL) {
  claimable = MAX_SINGLE_CLAIM_SOL; // Cap and let them claim remainder next time
}
```

Add minimum treasury reserve:

```text
const TREASURY_RESERVE_SOL = 0.05;
if (treasuryBalance / 1e9 < claimable + TREASURY_RESERVE_SOL) {
  throw new Error("Insufficient treasury balance");
}
```

**File: `src/components/panel/PanelMyLaunchesTab.tsx`**

No major changes needed -- it already shows `claimStatus?.pendingAmount` from the server. Just ensure the Claim button amount reflects server-verified data.

