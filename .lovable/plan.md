

## Fix: Phantom Launch "Block Height Exceeded" on TX2 + Dev Buy Cap

### Problems Found

1. **Block height exceeded on TX2**: The `confirmTx` function in Phantom mode just waits passively for confirmation. If the transaction doesn't land quickly (network congestion, no priority fees), the blockhash expires. The FUN mode works because it uses `submitAndConfirmRpc` which does proper confirmation with `lastValidBlockHeight` tracking. The Phantom mode's `confirmTx` fetches a new blockhash for confirmation but doesn't rebroadcast or track block height properly.

2. **Dev buy capped at 10 SOL on backend**: The edge function `fun-phantom-create` still has `Math.min(10, ...)` on line 70, silently clamping any dev buy above 10 SOL. The frontend was raised to 100 SOL but the backend wasn't updated.

### Root Cause Analysis

| Aspect | FUN Mode (works) | Phantom Mode (broken) |
|--------|------------------|-----------------------|
| Confirmation | `submitAndConfirmRpc` with proper `lastValidBlockHeight` | Custom `confirmTx` that fetches blockhash twice redundantly |
| Fresh blockhash | Yes, before each sign | Yes (added last fix) |
| Dev buy cap | No backend cap | 10 SOL cap in edge function |

### Fix Plan

**File 1: `src/components/launchpad/TokenLauncher.tsx`**

Replace the custom `confirmTx` function with the proven `submitAndConfirmRpc` pattern from FUN mode:

- Extract the `submitAndConfirmRpc` helper (or import it) to use the same confirmation logic: fetch `lastValidBlockHeight`, confirm with proper params, include 2s sync buffer
- Remove the redundant double-`getLatestBlockhash` calls in the current `confirmTx`
- Also use duck-typing for the blockhash replacement in `signAndSendTx` to guard against cross-realm `instanceof` failures (as documented in project memory)

Specifically:
1. Add a `submitAndConfirmRpc` function near the top of the launch handler (matching FUN mode's pattern)
2. Replace the `confirmTx` function body with a call to `submitAndConfirmRpc(connection, null, label, signature)`
3. In `signAndSendTx`, add duck-type fallback: if neither `instanceof` matches, check for `message.recentBlockhash` property and set it

**File 2: `supabase/functions/fun-phantom-create/index.ts`**

- Change line 70 from `Math.min(10, ...)` to `Math.min(100, ...)` to match the frontend's `DEV_BUY_MAX_SOL = 100`

### Technical Details

```text
signAndSendTx (updated)
  1. Fetch fresh blockhash
  2. Set blockhash using duck-typing (not just instanceof)
  3. Ephemeral keys sign
  4. Phantom signAndSendTransaction
  5. Return signature

confirmTx (replaced with submitAndConfirmRpc pattern)
  1. Fetch latestBlockhash with lastValidBlockHeight
  2. confirmTransaction with proper params
  3. Check confirmation.value.err
  4. 2s sync buffer
```

### Changes Summary

| File | Change |
|------|--------|
| `src/components/launchpad/TokenLauncher.tsx` | Replace `confirmTx` with `submitAndConfirmRpc` pattern; add duck-typing for blockhash replacement |
| `supabase/functions/fun-phantom-create/index.ts` | Raise dev buy cap from 10 to 100 SOL |

