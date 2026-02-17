

## Fix: Phantom Launch TX2 "Block Height Exceeded" + Dev Buy

### Root Cause (found after deep code review)

Two distinct problems are causing the launch to fail:

**Problem 1: Confirmation uses wrong blockhash**
When `signAndSendTransaction` is called, Phantom may inject its own blockhash (for Lighthouse protection). The frontend then tries to confirm using the blockhash IT set before signing -- but the on-chain transaction has Phantom's blockhash. This mismatch causes `confirmTransaction` to give up early ("block height exceeded") even though the transaction may have actually landed.

**Problem 2: TX2 too large when dev buy is merged**
The backend merges the dev buy swap into the pool creation transaction (`skipDevBuyMerge = false`). This makes TX2 very large. Phantom Lighthouse needs ~100-150 bytes of headroom to add its protection instructions. If TX2 exceeds ~1100 bytes, Lighthouse fails silently and the transaction either doesn't land or is rejected.

### Fix Plan

**File 1: `src/components/launchpad/TokenLauncher.tsx` -- Phantom Launch flow (lines 1157-1224)**

Replace the `confirmTx` function with a polling-based approach using `getSignatureStatuses` instead of `confirmTransaction`. This does NOT depend on matching the blockhash -- it just polls for the signature to appear on-chain.

```
confirmTx (new implementation):
  1. Poll getSignatureStatuses([signature]) every 2 seconds
  2. If status.err -> throw with on-chain error
  3. If confirmationStatus === 'confirmed' or 'finalized' -> success
  4. Timeout after 60 seconds
  5. 2-second sync buffer before next TX
```

Also apply the same fix to the Holders flow (lines 845-858) which has the identical bug.

**File 2: `api/pool/create-phantom.ts` (line ~167)**

Change `skipDevBuyMerge = false` to `skipDevBuyMerge = true`. This keeps the dev buy as a separate TX3, ensuring each transaction stays small enough for Phantom Lighthouse to add its instructions. The frontend's sequential signing loop already handles any number of transactions.

### What this means for the user

- Launch becomes a 3-step signing flow when dev buy is used: Config -> Pool -> Dev Buy
- Each step has a reliable confirmation that won't falsely fail
- Dev buy is still atomic with pool creation (happens right after pool confirms, before anyone else can trade)
- The 100 SOL dev buy cap (already fixed in edge function) continues to work correctly

### Files Changed

| File | Change |
|------|--------|
| `src/components/launchpad/TokenLauncher.tsx` | Replace `confirmTx` with signature polling (both Phantom + Holders flows) |
| `api/pool/create-phantom.ts` | Set `skipDevBuyMerge = true` to keep TX2 small |

