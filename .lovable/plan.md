
# Dev Buy Failure Fix Plan

## Problem Summary

Dev Buy (TX3) is not executing successfully despite 3 Phantom signature prompts. The root cause is that the current implementation only checks if transactions are **confirmed** (included in a block), but does not verify if they **succeeded** (no on-chain error).

On Solana, a transaction can be "confirmed" but still fail with `meta.err` set. The current code treats all confirmed transactions as successful, leading to silent failures.

---

## Investigation Findings

From the logs for wallet `Ea1WmcyvuvMiKbsMxRrnhq2H75KUjs2PRMqfSFh7aAHV`:
- Phase 1 correctly prepared 3 transactions with `devBuySol: 0.01 SOL`
- All 3 transactions were signed via Phantom
- Token was recorded in database (Phase 2 succeeded)
- However, the Dev Buy (TX3) likely failed on-chain without being detected

---

## Implementation Plan

### 1. Add Transaction Success Verification

**File: `src/components/launchpad/TokenLauncher.tsx`**

After `confirmTransaction`, add a verification step using `getSignatureStatuses`:

```
// Current (broken):
await connection.confirmTransaction(signature, "confirmed");

// Fixed:
await connection.confirmTransaction(signature, "confirmed");
const status = await connection.getSignatureStatuses([signature]);
if (status.value[0]?.err) {
  throw new Error(`TX${i+1} failed on-chain: ${JSON.stringify(status.value[0].err)}`);
}
```

### 2. Add Transaction Labels for Clarity

Return descriptive labels from the backend so the UI can show which step failed:
- TX1: "Create Config"
- TX2: "Create Pool"  
- TX3: "Dev Buy"

**File: `api/pool/create-phantom.ts`**

Add `txLabels` array to response alongside `unsignedTransactions`.

### 3. Add Balance Pre-Check for Dev Buy

Before initiating the 3-TX flow, estimate the total SOL needed:
- TX1 fee: ~0.01 SOL (config account rent + priority fee)
- TX2 fee: ~0.03 SOL (pool creation + ATA creation)
- TX3 fee: ~0.005 SOL + devBuySol amount

If wallet balance is insufficient, warn the user before they start signing.

### 4. Improve Dev Buy Input UX

**File: `src/components/launchpad/TokenLauncher.tsx`**

Fix input normalization so `.01` immediately displays as `0.01`:
- On change: if input starts with `.`, prepend `0`
- Already handled on blur, but should also happen on input

---

## Technical Details

### New Verification Helper

```text
async function verifyTransactionSuccess(
  connection: Connection,
  signature: string,
  label: string
): Promise<void> {
  const status = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true
  });
  
  if (!status.value[0]) {
    throw new Error(`${label}: Transaction not found`);
  }
  
  if (status.value[0].err) {
    throw new Error(
      `${label} failed: ${JSON.stringify(status.value[0].err)}`
    );
  }
}
```

### Enhanced Logging

Add console logging with structured debug info:
- Wallet SOL balance before each TX
- Signature and status for each TX
- Balance change after each TX (to confirm dev buy executed)

### Post-Launch Token Balance Check

After all TXs succeed, verify the creator received tokens:
```text
const tokenBalance = await connection.getTokenAccountBalance(creatorATA);
if (tokenBalance.value.uiAmount === 0 && devBuySol > 0) {
  console.warn('Dev buy may have failed - no tokens in wallet');
}
```

---

## Files to Modify

1. **`src/components/launchpad/TokenLauncher.tsx`**
   - Add `verifyTransactionSuccess` helper
   - Add pre-flight balance check
   - Fix `.01` to `0.01` normalization
   - Add structured error messages per TX step

2. **`api/pool/create-phantom.ts`**
   - Add `txLabels` to response
   - Add estimated fees breakdown

3. **`lib/meteora.ts`**
   - No changes needed (already logs TX3 creation correctly)

---

## Expected Outcome

After implementation:
- Users will see clear error messages if Dev Buy fails ("Dev Buy failed: insufficient funds")
- The UI will pre-check if wallet has enough SOL before starting
- Successful dev buys will be verified by checking on-chain token balance
- Input field will always show `0.01` format, never `.01`
