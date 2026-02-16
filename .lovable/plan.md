

## Fix FUN Mode: Use Working TokenLauncher Pattern

### Problem
The FUN mode uses a custom `sendAndConfirmWithRetry` function that polls `getSignatureStatuses` every 2 seconds. This is unreliable because:
- HTTP polling is slower and can be rate-limited by the RPC
- The SDK's `confirmTransaction` uses WebSocket subscriptions for instant confirmation detection
- The working Phantom launch flow in `TokenLauncher.tsx` uses `confirmTransaction` and works fine

### Solution
Replace `sendAndConfirmWithRetry` with the exact `submitAndConfirmRpc` pattern from `TokenLauncher.tsx` (lines 1173-1217), which:
1. Sends the raw transaction once
2. Starts a `setInterval` rebroadcast every 3 seconds
3. Uses `connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')` for confirmation (WebSocket-based)
4. Cleans up the interval in a `finally` block
5. Waits 2 seconds between sequential transactions

### Changes

**File: `src/pages/FunModePage.tsx`**

1. **Delete** the `sendAndConfirmWithRetry` function (lines 27-91)

2. **Replace** with `submitAndConfirmRpc` copied from TokenLauncher:
```text
async function submitAndConfirmRpc(
  connection, rawTx, label
):
  - Get fresh blockhash
  - sendRawTransaction (skipPreflight: false)
  - Start setInterval rebroadcast every 3s
  - connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  - Check confirmation.value.err
  - clearInterval in finally
  - Wait 2s sync buffer
  - Return signature
```

3. **Update launch loop** (line 243): Change `sendAndConfirmWithRetry(connection, rawTx, blockhash, lastValidBlockHeight, txLabel)` to `submitAndConfirmRpc(connection, rawTx, txLabel)`

4. **Update Remove LP** (line 332): Same change for the Remove LP flow

5. **Keep** the frontend priority fee injection (lines 217-222) -- this is correct and ensures high priority regardless of backend state

### Why This Will Work
This is the exact same code path that successfully launches tokens in the Phantom launch mode. No custom logic, no manual polling -- just the battle-tested SDK confirmation method with rebroadcast.
