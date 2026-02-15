

# Fix Phantom Lighthouse Warning: Jito Bundle Approach

## Problem
TX2 contains both pool creation AND dev buy instructions merged together. Even with ALT compression (V0 transactions), this combined transaction is too large for Phantom Lighthouse to simulate, triggering the "Request blocked" security warning.

## Solution: Jito Bundle for Atomic Execution Without Merging

Split dev buy back into a separate TX3, but submit TX2 + TX3 as a **Jito bundle**. Jito bundles guarantee atomic execution in the same block slot — all transactions land or none do. This eliminates the frontrunning window without stuffing everything into one transaction.

```text
CURRENT (broken):
  TX1: Create Config  -->  TX2: Create Pool + Dev Buy (TOO LARGE for Lighthouse)
                                    |
                              Phantom blocks it

PROPOSED (Jito bundle):
  TX1: Create Config  -->  [TX2: Create Pool] + [TX3: Dev Buy]  (Jito Bundle)
       |                        |                    |
   Sign + submit          Both signed by         Submitted as
   via RPC, wait          Phantom, then          atomic Jito bundle
   for confirm            ephemeral keys         (same slot, no frontrunning)
```

## Why This Works
- TX2 becomes small enough for Phantom Lighthouse to simulate (no warning)
- TX3 (dev buy) executes in the same block slot as TX2 via Jito bundle
- Jito bundles are all-or-nothing: if TX3 fails, TX2 also reverts
- This is exactly how pump.fun, Raydium launchers, and other platforms handle atomic dev buys
- The `src/lib/jitoBundle.ts` client already exists with retry logic and confirmation polling

## Changes Required

### 1. `lib/meteora.ts` — Re-enable `skipDevBuyMerge` logic
- Keep the existing `skipDevBuyMerge` parameter (already in code)
- When `skipDevBuyMerge=true`, dev buy stays as separate TX3 (already implemented)
- No changes needed here — the logic already exists

### 2. `api/pool/create-phantom.ts` — Set `skipDevBuyMerge: true` again
- Re-add `skipDevBuyMerge: true` to both `createMeteoraPool` and `createMeteoraPoolWithMint` calls
- This produces 3 transactions: Config, Pool, Dev Buy (when dev buy > 0)
- Add a `useJitoBundle: true` flag in the response so the frontend knows to bundle TX2+TX3

### 3. `src/components/launchpad/TokenLauncher.tsx` — Jito bundle submission
This is the main change. Update the transaction submission loop:

- **TX1 (Create Config)**: Sign with Phantom, partial-sign with ephemeral keys, submit via RPC, wait for confirmation (same as now)
- **TX2 (Create Pool) + TX3 (Dev Buy)**: Sign both with Phantom, partial-sign with ephemeral keys, then submit both together via `submitAndConfirmJitoBundle()` from `src/lib/jitoBundle.ts`
- Add a Jito tip instruction to TX3 (the last transaction in the bundle) before signing
- Fall back to sequential RPC submission if Jito bundle fails (degraded mode — user is warned about potential frontrunning)

### 4. Jito tip handling
- Add Jito tip instruction to TX3 before Phantom signing (tip goes in the last bundle tx per Jito docs)
- Use `createJitoTipInstruction` from existing `src/lib/jitoBundle.ts`
- Tip amount: 0.005 SOL (default in existing config)

## Technical Details

### Frontend signing flow (TokenLauncher.tsx):
```text
1. Deserialize 3 transactions (Config, Pool, Dev Buy)
2. Sign TX1 with Phantom -> partialSign -> sendRawTransaction -> wait confirm
3. Add Jito tip to TX3 (must be done before signing)
4. Sign TX2 with Phantom -> partialSign with ephemeral keys
5. Sign TX3 with Phantom -> partialSign with ephemeral keys  
6. submitAndConfirmJitoBundle([TX2, TX3]) -> atomic execution
7. If Jito fails -> fallback: send TX2 via RPC, wait, send TX3 via RPC
```

### Adding Jito tip to TX3 before signing:
The Jito tip instruction needs to be added to the unsigned TX3 before Phantom signs it. For VersionedTransaction, this means reconstructing the message with the additional instruction. For legacy Transaction, we can simply `.add()` the instruction.

### Response format change from backend:
Add `useJitoBundle: true` and `jitoTipLamports: 5000000` to the create-phantom response when there are 3+ transactions (pool + dev buy split).

## Risk Mitigation
- If Jito bundle submission fails (rate limit, network), fall back to sequential submission with a warning toast
- The Jito tip (0.005 SOL) is only added when bundling is used
- TX1 still uses standard RPC (config creation doesn't need MEV protection)

