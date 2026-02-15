

# Fix Phantom Lighthouse Warning — Sign-After-Confirm with Chained Simulation

## Problem

Lines 1177-1182 sign TX2 and TX3 with **separate** `signTransaction` calls. Even though TX1 is confirmed on-chain by that point, Phantom simulates TX3 independently of TX2 — and TX3 references the pool account that TX2 creates. Simulation fails, red warning appears.

## Fix (one change in one file)

### `src/components/launchpad/TokenLauncher.tsx` — Jito bundle branch (lines ~1164-1209)

Replace the individual signing of TX2 and TX3 with:

1. **TX1**: Keep as-is — `signTransaction(TX1)` then submit via RPC, wait for confirmation.
2. **TX2 + TX3**: After TX1 is confirmed, use `signAllTransactions([TX2, TX3])` in a single Phantom prompt. This lets Lighthouse chain-simulate TX2 then TX3 together. Then apply ephemeral sigs to both returned transactions and submit as Jito bundle.

```text
BEFORE (broken):
  signTransaction(TX1) → submit → confirm
  signTransaction(TX2) ← Lighthouse simulates alone, may warn
  signTransaction(TX3) ← Lighthouse simulates alone, WILL warn (pool missing)
  submitJitoBundle([TX2, TX3])

AFTER (fixed):
  signTransaction(TX1) → submit → confirm
  signAllTransactions([TX2, TX3]) ← Lighthouse chains simulation: TX2 ok (config on-chain), TX3 ok (pool from TX2)
  applyEphemeralSigs to both
  submitJitoBundle([TX2, TX3])
```

### Specific code change (lines 1177-1182)

Replace:
```typescript
toast({ title: `Signing ${txLabels[1]}...`, description: `Step 2 of ${txsToSign.length}` });
const signedTx2 = await signTx(txsToSign[1], 1, txLabels[1]);

toast({ title: `Signing ${txLabels[2]}...`, description: `Step 3 of ${txsToSign.length}` });
const signedTx3 = await signTx(txsToSign[2], 2, txLabels[2]);
```

With:
```typescript
toast({ title: `Signing Pool + Dev Buy...`, description: `Step 2 of 2 — one prompt` });
console.log('[Phantom Launch] Batch-signing TX2+TX3 via signAllTransactions (chained Lighthouse simulation)...');
const batchSigned = await phantomWallet.signAllTransactions([txsToSign[1], txsToSign[2]] as any);
if (!batchSigned || batchSigned.length < 2) throw new Error('Batch signing TX2+TX3 was cancelled or failed');
const signedTx2 = batchSigned[0];
const signedTx3 = batchSigned[1];
// dApp signs second with ephemeral keypairs (per Phantom multi-signer docs)
applyEphemeralSigs(signedTx2, 1, txLabels[1]);
applyEphemeralSigs(signedTx3, 2, txLabels[2]);
```

### Why this follows Phantom's requirements exactly

- **`signTransaction`** used for TX1 (single signer flow) — Phantom signs first, adds Lighthouse, then dApp applies ephemeral sigs and submits via own RPC.
- **`signAllTransactions`** used for TX2+TX3 — same protocol (Phantom signs first, adds Lighthouse to both), but batched so Lighthouse can chain-simulate TX2 then TX3. dApp applies ephemeral sigs after, submits via Jito.
- **ALT (Address Lookup Table)** keeps all transactions under the 1232-byte limit with headroom for Lighthouse assertions.
- **dApp submits via own RPC/Jito** — never uses `signAndSendTransaction`.

### No other files need changes

The backend, ALT setup, and Jito bundle logic remain unchanged.

