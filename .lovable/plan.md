

## Fix: Remove Duplicate ComputeBudgetProgram Instructions

### Root Cause

The transaction fails because it contains **duplicate** `ComputeBudgetProgram` instructions, which Solana rejects:

1. The **backend** (`api/pool/create-fun-mode.ts` lines 144-147) adds `setComputeUnitLimit(400K)` + `setComputeUnitPrice(1M microLamports)`
2. The **frontend** (`FunModePage.tsx` lines 201-204) ALSO prepends `setComputeUnitLimit(400K)` + `setComputeUnitPrice(1M microLamports)`

Solana only allows ONE of each ComputeBudget instruction type per transaction. Duplicates cause the transaction to be silently dropped by validators -- it gets a signature from the RPC but never lands in a block, eventually timing out with "block height exceeded."

The working TokenLauncher does NOT have this problem because it does not double-inject priority fees.

### Fix

**File: `src/pages/FunModePage.tsx`**

Remove the frontend priority fee injection (lines 200-205). The backend already handles this correctly with the right values (400K CU, 1M microLamports).

```
REMOVE these lines:
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
  );
  console.log(`[FUN Launch] Added priority fees to ${txLabel}...`);
```

Keep everything else as-is -- the fresh blockhash injection, the `submitAndConfirmRpc` confirmation pattern, and the ephemeral keypair signing are all correct.

### Why This Will Work

- The backend already includes the correct priority fee instructions in both TX1 and TX2
- Removing the frontend duplicate makes each transaction have exactly one of each ComputeBudget instruction
- This matches the TokenLauncher pattern exactly, where priority fees come only from the backend

### Risk

None. The backend values (400K CU, 1M microLamports) are already the higher values we want.

