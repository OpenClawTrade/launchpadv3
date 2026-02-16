

## Fix: Add Priority Fees in Frontend + Higher Fee Amount

### Why It's Still Failing

The priority fees were added to the Vercel backend (`api/pool/create-fun-mode.ts`), but:
1. The Vercel backend may not have been redeployed with those changes
2. Even if deployed, 50,000 microLamports with 200K CU = only 10,000 lamports (~0.00001 SOL) priority fee, which is too low during Solana congestion
3. The transaction gets accepted by the RPC (signature returned) but dropped by validators who prioritize higher-fee transactions

### Solution

Add priority fee instructions **directly in the frontend** (`src/pages/FunModePage.tsx`) before the user signs, so we don't depend on the Vercel backend. Use a much higher priority fee (1,000,000 microLamports).

### Changes

**File: `src/pages/FunModePage.tsx`**

In the signing loop (around line 209-237), after deserializing and setting the fresh blockhash, prepend `ComputeBudgetProgram` instructions to legacy `Transaction` objects:

```text
for each transaction:
  1. Deserialize TX
  2. Fetch fresh blockhash, set on TX
  3. NEW: If legacy Transaction, prepend ComputeBudgetProgram instructions:
     - setComputeUnitLimit(400_000)
     - setComputeUnitPrice({ microLamports: 1_000_000 })
  4. Sign with Phantom
  5. Partial sign with ephemeral keypairs
  6. Send + confirm with retry loop
```

For `VersionedTransaction`, we cannot easily prepend instructions (the message is compiled), but the backend already includes them. The first TX (Create Token) is always a legacy Transaction.

The cost increase is minimal: 1,000,000 microLamports * 400,000 CU / 1e6 = 400,000 lamports = 0.0004 SOL per TX.

Also remove the duplicate priority fee instructions check -- if the backend already added them, having duplicates is harmless (Solana uses the last ComputeBudget instruction of each type).

### Technical Details

```typescript
// Before signing, prepend priority fee instructions (legacy TX only)
if (tx instanceof Transaction) {
  const priorityIxs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
  ];
  // Prepend so they execute first
  tx.instructions.unshift(...priorityIxs);
}
```

This guarantees priority fees are present regardless of backend deployment state.
