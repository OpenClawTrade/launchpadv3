

## Fix: Phantom Launch "Block Height Exceeded" Error

### Problem
Phantom launches fail with "block height exceeded" because the transactions use a **stale blockhash** from when they were created on the backend. By the time the user reviews and signs (especially TX2 after TX1 confirms + 2s sync wait), the blockhash has expired.

### Root Cause
The FUN mode launch flow refreshes the blockhash right before each signing step -- the Phantom launch flow does NOT.

### Comparison

| Step | FUN Mode (works) | Phantom Mode (broken) |
|------|------------------|-----------------------|
| Before each sign | Fetches fresh blockhash, sets it on TX | Uses original stale blockhash from backend |

### Fix
In `src/components/launchpad/TokenLauncher.tsx`, inside the `signAndSendTx` function (around line 1148), add a fresh blockhash fetch and inject it into the transaction before ephemeral signing and wallet submission -- matching the FUN mode pattern.

### Technical Details

**File:** `src/components/launchpad/TokenLauncher.tsx`

**Location:** Inside `signAndSendTx` function (line 1148-1166)

**Change:** Add blockhash refresh before ephemeral signing:

```typescript
const signAndSendTx = async (tx: Transaction | VersionedTransaction, idx: number, label: string) => {
  console.log(`[Phantom Launch] signAndSendTransaction: ${label} (${idx + 1}/${txsToSign.length})...`);

  // Fetch fresh blockhash to prevent "block height exceeded" expiry
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  if (tx instanceof Transaction) {
    tx.recentBlockhash = blockhash;
  } else if (tx instanceof VersionedTransaction) {
    tx.message.recentBlockhash = blockhash;
  }

  // Ephemeral keys sign BEFORE wallet signs and sends
  // ... (rest unchanged)
```

This is a 4-line addition that matches the proven FUN mode pattern exactly. No other changes needed.

