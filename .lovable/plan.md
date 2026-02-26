

# Punch Token Fee Distribution Implementation

## Overview
Fees from punch token swaps are already being claimed from the Meteora pool to the treasury wallet. The problem is twofold: (1) the user's wallet isn't stored anywhere, and (2) `fun-distribute` skips punch tokens entirely. This fix adds a `punch_creator_wallet` column to track the user's payout address separately, then processes punch tokens with a 70/30 split during the normal distribution cycle.

## Security Model
- Fees flow: Pool -> Treasury (via `fun-claim-fees` cron) -> Creator wallet (via `fun-distribute`)
- Each claim has a `creator_distributed` boolean flag -- once set to `true`, it's never processed again
- The Record-Before-Send pattern inserts a `pending` distribution record before transferring SOL; on failure, claims stay unprocessed for retry
- The 70% creator share is calculated from `claimed_sol` at distribution time -- impossible to over-send since each claim is only counted once
- Minimum threshold of 0.05 SOL prevents dust transactions

## Changes

### 1. Database: Add `punch_creator_wallet` column to `fun_tokens`
- New nullable text column to store the user's payout wallet address
- `creator_wallet` continues to hold the system deployer wallet (for NFT/bonding authority)

### 2. Database: Update existing token record
- Set `punch_creator_wallet = '6Et74U2Mt6FeF1J4L7jnnEsV8MJW2XMEnneqgiWtrfRd'` for the already-launched token

### 3. `supabase/functions/punch-launch/index.ts`
- Add `punch_creator_wallet: creatorWallet` to the insert statement (user's wallet)
- Keep `creator_wallet` as system's `PUNCH_FEE_WALLET`
- Update description to wholesome theme

### 4. `supabase/functions/fun-distribute/index.ts`
- Add `PUNCH_CREATOR_FEE_SHARE = 0.7` and `PUNCH_SYSTEM_FEE_SHARE = 0.3` constants
- Replace the punch skip block (lines 252-256) with distribution logic:
  - Read `punch_creator_wallet` from the token (add it to the select query on line 178)
  - If no `punch_creator_wallet`, skip (log warning)
  - Group claims using key `punch:{token.id}:{punch_creator_wallet}`
  - Set `recipientType` to `"creator"` so it flows into the existing STEP 3-5 logic (pending record, SOL transfer, mark completed)
  - The 70/30 split is applied in the fee calculation section (around line 508) with a new `isPunchToken` check
  - Distribution recorded with `distribution_type: 'punch_creator'`

### 5. Cron: Add 3-minute schedule for `fun-distribute`
- Add a new cron entry running every 3 minutes to ensure frequent processing

## File Changes
- **Migration**: Add `punch_creator_wallet` column
- **Data update**: Set wallet for existing token
- **`supabase/functions/punch-launch/index.ts`**: Store user wallet in new column
- **`supabase/functions/fun-distribute/index.ts`**: Process punch tokens with 70/30 split
- **Cron SQL**: Schedule `fun-distribute` every 3 minutes

