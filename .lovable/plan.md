

# Jito Bundle Atomic Launch Implementation

## Overview

Use Jito Bundles to achieve **single-popup, atomic token launch** where pool creation + dev buy execute in the same block with zero front-running window. Jito API is **FREE** to use - the only cost is an optional tip (~0.001 SOL) for priority inclusion.

## Current Problem

```
Current: 3 separate Phantom popups + ~6s gap
┌──────────────────────────────────────────────────┐
│ Sign TX1 (Config) → confirm (~2s)                │
│ Sign TX2 (Pool)   → confirm (~2s)                │
│        ⚠️ SNIPERS CAN BUY HERE (~6s gap)        │
│ Sign TX3 (Swap)   → confirm (~2s)                │
└──────────────────────────────────────────────────┘
```

## Solution

```
New: 1 Phantom popup → Jito bundle → atomic execution
┌──────────────────────────────────────────────────┐
│ signAllTransactions([TX1, TX2, TX3])             │
│              ↓ (single popup)                    │
│        Submit to Jito Block Engine               │
│              ↓                                   │
│   [Config + Pool + Swap] in SAME BLOCK           │
│        ✅ No frontrunning possible               │
└──────────────────────────────────────────────────┘
```

## Technical Implementation

### 1. Add `signAllTransactions` to usePhantomWallet Hook

**File: `src/hooks/usePhantomWallet.ts`**

Add method to sign multiple transactions at once:

```typescript
const signAllTransactions = useCallback(async <T extends Transaction | VersionedTransaction>(
  transactions: T[]
): Promise<T[] | null> => {
  const provider = getProvider();
  if (!provider?.signAllTransactions) return null;
  
  try {
    return await provider.signAllTransactions(transactions);
  } catch (error) {
    throw error;
  }
}, [getProvider]);
```

### 2. Create Browser-Side Jito Client

**File: `src/lib/jitoBundle.ts` (NEW)**

Create a client-side helper to submit signed transactions to Jito:

```typescript
// Jito Block Engine endpoints (same as lib/jito.ts)
const JITO_ENDPOINTS = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

// Tip accounts for optional priority tips
const TIP_ACCOUNTS = ['96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5', ...];

export async function submitJitoBundle(
  signedTransactions: (Transaction | VersionedTransaction)[]
): Promise<{ bundleId: string; signatures: string[] }>;

export async function waitForBundleConfirmation(
  bundleId: string, 
  timeoutMs?: number
): Promise<{ confirmed: boolean; slot?: number }>;
```

### 3. Update TokenLauncher.tsx - Phantom Launch Flow

**File: `src/components/launchpad/TokenLauncher.tsx`**

Replace sequential signing loop with atomic Jito bundle:

```typescript
// OLD: Sequential (frontrun-able)
for (const tx of transactions) {
  await phantomWallet.signAndSendTransaction(tx);
  await connection.confirmTransaction(...);
}

// NEW: Atomic via Jito bundle
const txs = transactions.map(deserializeAnyTx);

// Set fresh blockhash on all transactions
const { blockhash } = await connection.getLatestBlockhash('confirmed');
txs.forEach(tx => {
  if (tx instanceof Transaction) tx.recentBlockhash = blockhash;
  else tx.message.recentBlockhash = blockhash;
});

// Single Phantom popup for all 3
const signedTxs = await phantomWallet.signAllTransactions(txs);

// Submit bundle to Jito
const { bundleId, signatures } = await submitJitoBundle(signedTxs);

// Wait for atomic confirmation
const result = await waitForBundleConfirmation(bundleId);
if (!result.confirmed) throw new Error('Bundle not included');
```

### 4. Add Optional Jito Tip Transaction

For higher priority (busy network conditions), append a tip instruction:

```typescript
// Only if user enables "priority mode" or network is congested
const tipInstruction = SystemProgram.transfer({
  fromPubkey: phantomWallet.publicKey,
  toPubkey: getRandomTipAccount(),
  lamports: 1_000_000, // 0.001 SOL tip (optional)
});

// Add to last transaction or as separate TX4
```

### 5. Update Backend to Support Bundle Mode

**File: `api/pool/create-phantom.ts`**

Add flag to indicate bundle-compatible response:

```typescript
return res.status(200).json({
  success: true,
  mintAddress,
  dbcPoolAddress,
  unsignedTransactions: serializedTransactions,
  bundleMode: true, // Frontend should use Jito bundle
  // Don't set blockhash - frontend will set fresh one
});
```

## User Experience Changes

| Before | After |
|--------|-------|
| 3 Phantom popups | 1 Phantom popup |
| 6+ seconds between pool & swap | 0ms (same block) |
| Dev buy can be sniped | Atomic, guaranteed first |
| "Sign 1/3, Sign 2/3, Sign 3/3" | "Launch Token" (one click) |

## Cost Analysis

- **Jito API**: FREE (no subscription needed)
- **Jito tip**: Optional, ~0.001 SOL for priority
- **Network fees**: Same as before (~0.01-0.03 SOL)

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePhantomWallet.ts` | Add `signAllTransactions` method |
| `src/lib/jitoBundle.ts` | NEW - Browser Jito bundle submission |
| `src/components/launchpad/TokenLauncher.tsx` | Replace sequential signing with bundle |
| `api/pool/create-phantom.ts` | Add `bundleMode` flag, remove blockhash |

## Fallback Strategy

If Jito bundle fails (rare):
1. Log failure reason
2. Offer retry with different Jito endpoint
3. If 3 retries fail, fall back to sequential mode with warning

## Summary

This implementation achieves pump.fun-level UX:
- **1 signature** instead of 3
- **Atomic execution** (pool + dev buy in same block)
- **Zero frontrunning** window
- **FREE** Jito API usage

