

# Fix: Real On-Chain Swap Transactions

## Current Problem

The swap system is entirely virtual/database-only. When a user clicks "Buy" or "Sell":

1. The `TradePanelWithSwap` component calls `executeSwap` from `useLaunchpad`
2. `useLaunchpad.executeSwap` calls the `launchpad-swap` edge function
3. The edge function does math on virtual reserves, updates database tables (`tokens`, `token_holdings`, `launchpad_transactions`), and returns success
4. **No on-chain transaction is ever created or signed** -- the signature is a fake `pending_` placeholder
5. The user's SOL balance is never debited, and no tokens are actually transferred

This means all trades are fake -- just database entries with no blockchain activity.

## Two Token States to Handle

### 1. Pre-graduation tokens (bonding curve, status = "active"/"bonding")
These tokens live on Meteora Dynamic Bonding Curve (DBC) pools. Real swaps require building a Meteora DBC swap transaction on-chain.

### 2. Graduated tokens (status = "graduated")
These tokens have migrated to DEX liquidity. Real swaps should go through Jupiter aggregator (already have `useJupiterSwap` hook).

## Implementation Plan

### Step 1: Update the `launchpad-swap` edge function to build real Meteora DBC transactions

Currently the edge function only does DB math. It needs to:
- Build a real Meteora DBC swap instruction using the pool's on-chain program
- Serialize the transaction and return it to the client as a base64-encoded `VersionedTransaction`
- Wait for the client to sign and send, then confirm on-chain before updating the DB

**However**, building Meteora DBC instructions server-side in Deno edge functions is complex (requires SDK, on-chain account lookups). A more practical approach:

### Step 1 (Revised): Client-side transaction building for bonding curve swaps

Modify `TradePanelWithSwap` to:
- For **bonding curve tokens**: Use the Meteora DBC SDK (`@meteora-ag/dynamic-bonding-curve-sdk`) to build the swap transaction client-side, sign with Privy embedded wallet, send to chain, then record the confirmed signature in the database via the edge function
- For **graduated tokens**: Use the existing `useJupiterSwap` hook to swap via Jupiter

### Step 2: Create a new `useRealSwap` hook

This hook will:
1. Determine if the token is bonding curve or graduated
2. For bonding curve: Use Meteora DBC SDK to fetch the pool, build swap IX, create transaction, sign via Privy `signAndSendTransaction`, confirm, then call the edge function with the real signature
3. For graduated: Use `useJupiterSwap.buyToken` / `sellToken` with the Privy wallet's `signAndSendTransaction`
4. Show real SOL balance from the embedded wallet

### Step 3: Update `TradePanelWithSwap` component

- Replace the current `useLaunchpad().executeSwap` call with the new `useRealSwap` hook
- Display the user's real SOL balance from Privy embedded wallet (currently shows "Bal: --")
- After a successful on-chain swap, update the edge function DB records with the real tx signature
- Remove the fake success path

### Step 4: Update the `launchpad-swap` edge function role

Change it from "execute swap" to "record swap":
- Accept a confirmed transaction signature
- Verify the transaction on-chain (optional but recommended)
- Update virtual reserves, holdings, and price in the database
- This ensures DB state stays in sync with on-chain reality

### Step 5: Display real wallet balances

- Show real SOL balance from `useSolanaWalletWithPrivy().getBalance()`
- For token balances of bonding curve tokens, query the on-chain token account
- For graduated tokens, query via RPC `getTokenAccountsByOwner`

---

## Technical Details

### Files to create:
- `src/hooks/useRealSwap.ts` -- New hook coordinating real on-chain swaps

### Files to modify:
- `src/components/launchpad/TradePanelWithSwap.tsx` -- Use `useRealSwap` instead of `useLaunchpad().executeSwap`, show real balances
- `supabase/functions/launchpad-swap/index.ts` -- Add mode to accept confirmed signatures and verify on-chain before DB updates
- `src/components/launchpad/QuickTradeButtons.tsx` -- Same swap flow update

### Dependencies already available:
- `@meteora-ag/dynamic-bonding-curve-sdk` (installed)
- `@solana/web3.js` (installed)
- `useJupiterSwap` hook (exists for graduated tokens)
- `useSolanaWalletWithPrivy` hook (exists for Privy wallet signing)

### Swap flow after fix:

```text
User clicks Buy
  |
  v
useRealSwap determines token status
  |
  +-- Bonding curve token:
  |     1. Fetch Meteora DBC pool on-chain
  |     2. Build swap instruction via SDK
  |     3. Create VersionedTransaction
  |     4. Sign + send via Privy signAndSendTransaction
  |     5. Wait for confirmation
  |     6. Call launchpad-swap edge function with real signature to update DB
  |     7. Show success with Solscan link
  |
  +-- Graduated token:
        1. Get quote from Jupiter API v1
        2. Build swap transaction
        3. Sign + send via Privy signAndSendTransaction
        4. Wait for confirmation
        5. Show success with Solscan link
```

