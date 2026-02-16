

## Fix: Add Priority Fees + Retry-Send Loop for FUN Mode Transactions

### Root Cause

The transactions built by the backend (`api/pool/create-fun-mode.ts`) contain NO `ComputeBudgetProgram` instructions (priority fees). On Solana mainnet, validators prioritize transactions with higher fees. Without them, the transaction is accepted by the RPC but dropped before inclusion in a block. The blockhash expires, and the user sees "block height exceeded."

### Two-Part Fix

#### Part 1: Add Priority Fee Instructions (Frontend)

Before signing each transaction in `src/pages/FunModePage.tsx`, prepend two `ComputeBudgetProgram` instructions:

- `setComputeUnitLimit(200_000)` - reasonable CU budget for token + pool creation
- `setComputeUnitPrice(50_000)` - ~0.01 SOL priority fee, enough to land reliably

For **legacy `Transaction`** objects, we can prepend instructions directly. For **`VersionedTransaction`** objects, we need to rebuild the message with the extra instructions (more complex), OR we add the priority fee instructions in the backend.

Since the backend builds the transactions, the cleanest approach is to add priority fees in **`api/pool/create-fun-mode.ts`** where both transactions (TX1: Create Token, TX2: Create Pool) are constructed.

**File: `api/pool/create-fun-mode.ts`**

1. Import `ComputeBudgetProgram` from `@solana/web3.js`
2. Add two instructions at the start of both TX1 and TX2:
   ```
   ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })
   ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
   ```

#### Part 2: Retry-Send During Confirmation (Frontend)

In `src/pages/FunModePage.tsx`, replace the simple `sendRawTransaction` + `confirmTransaction` with a retry loop that rebroadcasts the raw transaction every 2 seconds while polling for confirmation. This is a standard Solana reliability pattern:

```text
1. Send raw TX, get signature
2. Start parallel:
   a. Poll getSignatureStatuses every 2 seconds
   b. Re-send raw TX every 2 seconds (idempotent - same signature)
3. Stop when confirmed OR block height exceeded
```

This ensures that if the first broadcast is dropped, subsequent rebroadcasts have a chance to land.

**File: `src/pages/FunModePage.tsx`**

Create a helper function `sendAndConfirmWithRetry(connection, rawTx, blockhash, lastValidBlockHeight)` that:
- Sends the initial transaction
- Every 2 seconds: re-sends AND checks signature status
- Returns the signature once confirmed
- Throws if `lastValidBlockHeight` is exceeded

### Changes Summary

| File | Change |
|------|--------|
| `api/pool/create-fun-mode.ts` | Add `ComputeBudgetProgram` priority fee instructions to TX1 and TX2 |
| `src/pages/FunModePage.tsx` | Add `sendAndConfirmWithRetry` helper with rebroadcast loop; use it for both launch and Remove LP flows |

### Cost Impact

The priority fee adds approximately 0.01 SOL per transaction (0.02 SOL total for the 2-TX flow). Combined with the existing ~0.06 SOL cost, total launch cost becomes ~0.08 SOL.

