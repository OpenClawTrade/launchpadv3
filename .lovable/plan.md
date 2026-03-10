

# Privy Server SDK Integration for Server-Side User Trade Execution

## Problem
1. **Build error**: `vendor-phosphor` chunk on line 39 of `vite.config.ts` was not removed in the previous edit, causing build failures.
2. **No server-side trade execution for users**: The platform can only execute trades using the sniper wallet (`SNIPER_PRIVATE_KEY`), not from individual user embedded wallets. This blocks features like auto-sniping on behalf of users, limit orders, and support-triggered trades.

## Solution

### 1. Fix Build Error
Remove the `vendor-phosphor` manual chunk from `vite.config.ts` line 39. This was identified as problematic because `@phosphor-icons/react` is referenced across 37+ files and isolating it causes import resolution failures.

### 2. Create Privy Server Wallet Helper (Shared Module)
Create a shared utility at `supabase/functions/_shared/privy-server-wallet.ts` that wraps the Privy REST API for server-side wallet operations:

- **Look up user's embedded wallet** by Privy DID (`GET /v1/users/{user_id}`)
- **Sign and send Solana transactions** on behalf of user (`POST /v1/wallets/{wallet_id}/rpc` with `signAndSendTransaction`)
- **Sign transactions** without sending (`POST /v1/wallets/{wallet_id}/rpc` with `signTransaction`)
- Uses Basic Auth with `PRIVY_APP_ID:PRIVY_APP_SECRET` (both already configured as secrets)

The Privy REST API approach is preferred over `@privy-io/node` npm package because:
- No npm dependency needed in Deno edge functions
- Direct HTTP calls are simpler and more reliable in edge runtime
- Full control over request/response handling

### 3. Store Privy Wallet IDs in Database
Add a `privy_wallet_id` column to the `profiles` table so we can map users to their Privy wallet IDs for server-side signing. Update `sync-privy-user` to fetch and store the wallet ID from Privy's API when a user first syncs.

### 4. Create `server-trade` Edge Function
A new edge function that accepts:
- `privyUserId` or `profileId` or `walletAddress` — to identify the user
- `mintAddress` — token to trade
- `amount` — SOL (buy) or tokens (sell)
- `isBuy` — direction
- `slippageBps` — slippage tolerance

Flow:
1. Look up user's Privy wallet ID from `profiles` table (or fetch from Privy API)
2. Build the swap transaction (via Meteora API for bonding curve tokens, Jupiter for graduated)
3. Sign and send via Privy REST API (`signAndSendTransaction`)
4. Record transaction in `launchpad_transactions`

### 5. Update Sniper Functions to Support User Wallets
Modify `fun-sniper-buy` and `fun-sniper-sell` to optionally accept a `userPrivyWalletId` parameter. When provided, sign with the user's embedded wallet via Privy API instead of the sniper keypair.

## Technical Architecture

```text
Client Request / Cron / Admin Action
        │
        ▼
  server-trade (edge function)
        │
        ├── Look up privy_wallet_id from profiles table
        │
        ├── Build swap tx (Meteora API / Jupiter)
        │
        ├── POST https://api.privy.io/v1/wallets/{wallet_id}/rpc
        │       method: signAndSendTransaction
        │       Auth: Basic {APP_ID}:{APP_SECRET}
        │
        └── Record tx in launchpad_transactions
```

## Database Migration
```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS privy_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS privy_did TEXT;
```

## Files to Create/Modify
1. **`vite.config.ts`** — Remove `vendor-phosphor` chunk (fix build)
2. **`supabase/functions/_shared/privy-server-wallet.ts`** — Privy REST API helper for server-side signing
3. **`supabase/functions/server-trade/index.ts`** — New edge function for server-side user trades
4. **`supabase/functions/sync-privy-user/index.ts`** — Store `privy_wallet_id` and `privy_did` on profile sync
5. **Database migration** — Add `privy_wallet_id` and `privy_did` columns to `profiles`
6. **`supabase/config.toml`** — Register new edge function with `verify_jwt = false`

## Security
- Server-trade function validates caller via service role key or admin API key
- Privy REST API enforces wallet ownership — only wallets created under your app can be signed
- All trades are recorded with full audit trail in `launchpad_transactions`

