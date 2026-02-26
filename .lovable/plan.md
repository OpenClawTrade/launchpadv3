

# Fix Punch Token Fee Distribution for Existing Tokens

## Problem
All punch tokens except the first one have `punch_creator_wallet = NULL`, causing the fee distribution to skip them. About 0.21 SOL in claimed fees is sitting undistributed in the treasury.

## Root Cause
The `punch_creator_wallet` column wasn't being populated when these tokens were created (the edge function update wasn't deployed yet or the frontend sent the system wallet).

## Fix

### 1. Database Migration: Backfill `punch_creator_wallet`
Set `punch_creator_wallet` to `J65y5McWeTieCkUEkuWSmpfQsoY2aSWazcvkPfUnBCwr` for all punch tokens that currently have NULL. Since the user who launched all these tokens was using wallet `J65y5Mc...`, this is the correct payout address.

```sql
UPDATE fun_tokens 
SET punch_creator_wallet = 'J65y5McWeTieCkUEkuWSmpfQsoY2aSWazcvkPfUnBCwr'
WHERE launchpad_type = 'punch' 
  AND punch_creator_wallet IS NULL;
```

### 2. Verify `punch-launch` Edge Function
Confirm that the current deployed version of `punch-launch/index.ts` correctly stores `punch_creator_wallet: creatorWallet` in the insert. This was already added in a previous edit -- just need to make sure the deployed function matches the code.

## Result
After the backfill, the next `fun-distribute` cron run (every 3 minutes) will:
- Pick up the ~0.21 SOL in undistributed claims
- Send 70% to `J65y5Mc...` (the punch creator)
- Keep 30% in treasury (system share)

## Technical Details
- Only 1 DB migration needed (the UPDATE statement above)
- No code changes required -- the distribution logic already handles punch tokens correctly
- The `punch-launch` edge function already includes `punch_creator_wallet` in the insert

