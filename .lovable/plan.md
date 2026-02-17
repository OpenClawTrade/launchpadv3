

## Fix: Promise.race Bug + Dev Buy Cap in Backend API + Comprehensive Logging

### Critical Bug Found: Promise.race Kills Polling

The `Promise.race([websocketConfirm(), pollingConfirm()])` pattern is fundamentally broken:

- `websocketConfirm()` fetches a fresh blockhash and calls `confirmTransaction`. If the RPC doesn't find the signature before that blockhash expires (~150 blocks / ~60s), it **throws** "block height exceeded"
- `Promise.race` **rejects immediately** when ANY promise rejects -- it does NOT wait for the other
- So the polling method (which would have found the TX) never gets a chance

This is why Config TX succeeds on-chain but the frontend reports "block height exceeded" -- the WebSocket method rejects first and kills the race.

### Second Bug: Dev Buy Still Capped at 10 SOL in Vercel API

`api/pool/create-phantom.ts` line 120 still has `Math.min(10, ...)`. The edge function was fixed to 100 but the actual API endpoint that builds transactions was not.

### Third Issue: Prompt Delay

The balance check tries 3 RPC endpoints sequentially (5s timeout each). If the first one is slow, this adds 5-10s before anything visible happens. Should use parallel racing instead.

---

### Fix 1: `src/components/launchpad/TokenLauncher.tsx` -- Phantom Flow confirmTx

Wrap `websocketConfirm` in a catch so it returns a never-resolving promise on error, letting polling continue:

```text
websocketConfirm:
  try confirmTransaction
  if err -> return new Promise that never resolves (let polling win)
  
pollingConfirm:
  poll getSignatureStatuses every 2s for 90s
  searchTransactionHistory: true
  
Promise.race([websocketConfirm(), pollingConfirm()])
  -> now only rejects if BOTH fail (polling timeout)
```

### Fix 2: Same fix for Holders Flow (lines 847-868)

Same `Promise.race` bug exists. Apply identical catch-wrapper pattern.

### Fix 3: `api/pool/create-phantom.ts` line 120

Change `Math.min(10, ...)` to `Math.min(100, ...)`.

### Fix 4: Speed up balance check

Race all 3 RPC balance fetches in parallel instead of sequential. First success wins.

### Fix 5: Comprehensive debug logging

Add timestamped logs at every step of the launch flow:
- Time from "Launch clicked" to edge function call
- Time from edge function response to first Phantom prompt
- Time for each confirmation attempt (WebSocket vs polling winner)
- Full error details with signature links

### Files Changed

| File | Change |
|------|--------|
| `src/components/launchpad/TokenLauncher.tsx` | Fix Promise.race in both Phantom and Holders flows; parallel balance check; detailed logging |
| `api/pool/create-phantom.ts` | Change dev buy cap from 10 to 100 SOL (line 120) |

### Technical Detail: The Safe Promise.race Pattern

```typescript
const confirmTx = async (sig: string, label: string) => {
  const t0 = Date.now();
  
  // WebSocket: catch errors so it never rejects the race
  const wsConfirm = async () => {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const c = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (c.value.err) throw new Error(`${label} on-chain error: ${JSON.stringify(c.value.err)}`);
      return "websocket";
    } catch (e) {
      // On-chain errors should propagate
      if (e instanceof Error && e.message.includes("on-chain error")) throw e;
      // Other errors (block height exceeded, timeout): DON'T reject, let polling win
      console.warn(`[Phantom Launch] WS confirm failed for ${label}, falling back to polling:`, e);
      return new Promise<never>(() => {}); // Never resolves, never rejects
    }
  };

  // Polling: always the reliable fallback
  const pollConfirm = async () => {
    while (Date.now() - t0 < 90000) {
      const { value } = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
      const s = value?.[0];
      if (s?.err) throw new Error(`${label} on-chain error: ${JSON.stringify(s.err)}`);
      if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") return "polling";
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`${label} timed out after 90s. Solscan: https://solscan.io/tx/${sig}`);
  };

  const method = await Promise.race([wsConfirm(), pollConfirm()]);
  console.log(`[Phantom Launch] ${label} confirmed via ${method} in ${Date.now() - t0}ms`);
  await new Promise(r => setTimeout(r, 2000)); // sync buffer
};
```

This ensures the WebSocket path NEVER kills the polling fallback.
