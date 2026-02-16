

## Fix: Transaction Blockhash Expiry in FUN Mode Launch

### Problem
The backend creates transactions with a blockhash at creation time. By the time the user reviews and signs in Phantom (could be 10-30+ seconds), that blockhash expires. The transaction is then rejected by the Solana network ("block height exceeded").

### Root Cause (line 143-167 of FunModePage.tsx)
1. Backend sets blockhash when building TX
2. User takes time to sign in Phantom popup  
3. Frontend fetches a NEW blockhash (line 161) but only uses it for confirmation polling
4. The transaction still contains the OLD expired blockhash
5. Network rejects the transaction silently; confirmation times out

### Fix

**File: `src/pages/FunModePage.tsx`** - In the signing loop (lines 143-170):

1. BEFORE presenting the transaction to Phantom for signing, fetch a fresh blockhash
2. If the transaction is a legacy `Transaction`, update its `recentBlockhash` property
3. Use that same blockhash for confirmation after sending
4. Remove the redundant `getLatestBlockhash` call after sending (line 161)

```text
Before (current flow):
  deserialize TX (old blockhash) -> Phantom signs -> get new blockhash -> send -> confirm with new blockhash

After (fixed flow):
  deserialize TX -> get fresh blockhash -> set it on TX -> Phantom signs -> send -> confirm with same blockhash
```

### Secondary Fix: Remove LP flow (line 253)

The `handleRemoveFunLp` function at line 253 still uses the deprecated `confirmTransaction(signature, "confirmed")` call. Update it to use the blockhash-based confirmation as well, with the same "set fresh blockhash before signing" pattern.

### Technical Details

For legacy `Transaction` objects:
```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
tx.recentBlockhash = blockhash;
// Then sign, send, and confirm using { signature, blockhash, lastValidBlockHeight }
```

For `VersionedTransaction` objects:
```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
tx.message.recentBlockhash = blockhash;
// Then sign, send, and confirm
```

This ensures the blockhash inside the transaction matches what the network expects, eliminating the expiry window.

