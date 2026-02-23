

# Fix: Cross-Table Distribution Check + Remove Old Claim Function

## Problem
There are TWO claim functions with TWO separate distribution tables, creating a security gap:

1. **Old function** (`agent-creator-claim`): reads/writes `fun_distributions`
2. **New function** (`claw-creator-claim`): reads/writes `claw_distributions`

Neither function checks the other's table. A user could theoretically call both functions and double-claim. Additionally, the old `agent-creator-claim` function is still deployed and accessible.

For user `@sandracinca` specifically: their 1.1769 SOL is genuinely unclaimed (zero records in either distribution table). The first claim will work correctly. The concern is preventing abuse after that first claim.

## Fix Plan

### 1. Update `claw-creator-claim` to also check `fun_distributions`
In the `calculateClaimable` function, add a query to `fun_distributions` for the same token IDs and merge those paid amounts into the total. This ensures that any past distributions recorded by the old system are accounted for.

Changes to `supabase/functions/claw-creator-claim/index.ts`:
- In `calculateClaimable()`, after querying `claw_distributions`, also query `fun_distributions` for matching token IDs and twitter_username
- Merge and deduplicate both sets of distributions before calculating `totalCreatorPaid`

### 2. Delete the old `agent-creator-claim` edge function
Remove `supabase/functions/agent-creator-claim/index.ts` and delete the deployed function. This eliminates the secondary claim vector entirely. The frontend already only calls `claw-creator-claim`.

### 3. Frontend: disable claim button when `checkOnly` returns `canClaim: false`
Currently the claim button is only disabled based on local `totalUnclaimed` math. Update `PanelMyLaunchesTab.tsx` to:
- Use `claimStatus?.canClaim === false` to grey out the button
- Show remaining cooldown time from `claimStatus?.remainingSeconds` on the button text
- Disable the button entirely when `claimStatus?.pendingAmount < MIN_CLAIM_SOL`

### Technical Details

**Edge function change** (`claw-creator-claim/index.ts`, `calculateClaimable` function):
```
// After existing claw_distributions queries, add:
const { data: funDistByToken } = await supabase
  .from("fun_distributions")
  .select("amount_sol, fun_token_id, id")
  .in("fun_token_id", targetTokenIds)
  .in("distribution_type", ["creator_claim", "creator"])
  .in("status", ["completed", "pending"]);

const { data: funDistByUsername } = await supabase
  .from("fun_distributions")
  .select("amount_sol, fun_token_id, id")
  .eq("twitter_username", normalizedUsername)
  .in("distribution_type", ["creator_claim", "creator"])
  .in("status", ["completed", "pending"]);

// Merge fun_distributions into allDists (prefix IDs to avoid collision)
for (const d of [...(funDistByToken || []), ...(funDistByUsername || [])]) {
  allDists.set("fun_" + d.id, d);
}
```

**Frontend change** (`PanelMyLaunchesTab.tsx`):
- Line 260: Add `claimStatus?.canClaim === false` to the disabled condition
- Update button text to show cooldown when rate-limited
