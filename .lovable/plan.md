

# Phantom Launch Flow Refactoring Plan

## Problem Summary

The current Phantom launch implementation has multiple issues that deviate from industry standards:

1. **Jito Tip Placement Error**: The tip transaction is added as a **separate first transaction** in the bundle. Per Jito documentation, **tips must be an instruction in the LAST transaction** of the bundle to prevent theft and ensure proper auction mechanics.

2. **Jito Rate Limiting (429)**: The public Jito Block Engine endpoints are globally rate-limited. After submission succeeds, bundles fail to confirm within 60s because they're either dropped or lose the auction.

3. **Bundle Not Confirmed**: Even when bundles are submitted successfully, the 60-second timeout suggests the bundle isn't landing on-chain. This is likely caused by:
   - Incorrect tip placement (separate tx vs. embedded instruction)
   - Insufficient tip amount (current: 0.001 SOL)
   - Transaction staleness (blockhash expires before bundle lands)

4. **Fallback Missing**: When Jito bundles fail, there's no fallback to sequential `signAndSendTransaction` calls.

---

## Industry Standard Approach

Based on Jito documentation and Meteora DBC SDK patterns:

**Option A - Jito Bundle (Atomic, MEV-Protected)**
- Embed tip instruction in the **last transaction** of the bundle (not a separate tx)
- Use higher tip amounts during congestion (0.001-0.01 SOL dynamic)
- Single Phantom `signAllTransactions` popup
- Submit all transactions atomically to Jito

**Option B - Sequential signAndSendTransaction (Simpler, More Reliable)**
- Use Phantom's `signAndSendTransaction` for each transaction
- Phantom handles submission, retry, and confirmation internally
- Blowfish security scanning works correctly
- Multiple popups but more reliable on-chain landing

**Recommendation**: Use **Option B as primary** (most reliable) with **Option A as fallback** when user explicitly requests atomic execution.

---

## Proposed Changes

### 1. Backend: Embed Jito Tip in Last Transaction (`api/pool/create-phantom.ts`)

Instead of the frontend creating a separate tip transaction, the backend will:
- Add a Jito tip instruction to the **last transaction** in the bundle
- Return transactions ready for signing (no frontend tip addition needed)
- Flag whether atomic bundle mode is available

```text
Current flow:
  Frontend adds tipTx → [tipTx, configTx, poolTx, devBuyTx]
  ❌ Jito rejects: tip not in last tx

Fixed flow:
  Backend adds tipIx to last tx → [configTx, poolTx, devBuyTx+tipIx]
  ✅ Jito accepts: tip embedded in last tx
```

### 2. Frontend: Primary Mode = Sequential signAndSendTransaction (`TokenLauncher.tsx`)

Change the default launch flow to use Phantom's native `signAndSendTransaction`:

1. Deserialize transactions from backend
2. For each transaction, call `phantomWallet.signAndSendTransaction(tx)`
3. Wait for confirmation before proceeding to next
4. Record token in DB after all succeed

**Benefits**:
- Single popup per transaction but most reliable on-chain landing
- Blowfish security scanning works correctly (per project memory)
- No Jito rate limiting issues
- Native retry/confirmation handling by Phantom

### 3. Frontend: Optional Jito Bundle Mode (Advanced)

Keep Jito bundle as an opt-in advanced feature:

1. Fix tip placement: Add tip instruction to **last transaction** (not separate tx)
2. Use Phantom `signAllTransactions` for single popup
3. Submit to Jito with increased tip (0.005-0.01 SOL)
4. Add exponential backoff for 429 errors
5. Increase confirmation timeout to 90s
6. If bundle fails after retries, show option to retry with sequential mode

### 4. Client-Side Jito Bundle Fix (`src/lib/jitoBundle.ts`)

If bundle mode is used:
- Remove the frontend tipTx creation
- Expect backend to have already embedded tip in last tx
- Increase MAX_RETRIES to 7 with longer backoff
- Add bundle simulation before submission (optional)

---

## Detailed File Changes

### `api/pool/create-phantom.ts`
- Add `addJitoTipToLastTransaction()` helper function
- Before serializing transactions, inject Jito tip instruction into the last transaction
- Return `jitoTipEmbedded: true` flag in response

### `src/components/launchpad/TokenLauncher.tsx`
- **Primary flow**: Loop through transactions and call `signAndSendTransaction` sequentially
- Remove frontend tip transaction creation
- Add `useJitoBundle` toggle state (default: false)
- If Jito bundle fails, show toast with "Retry with sequential mode" option

### `src/lib/jitoBundle.ts`
- Remove `createJitoTipInstruction` usage from bundle submission (tip is now in tx)
- Increase `MAX_RETRIES` to 7
- Increase `CONFIRMATION_TIMEOUT_MS` to 90,000
- Add optional bundle simulation step

### `src/hooks/usePhantomWallet.ts`
- No changes needed (already has signAndSendTransaction)

---

## Transaction Count

**Current**: 4 transactions (tipTx + 2-3 pool txs) = 4 Phantom popups or 1 batch popup

**After Fix**:
- Sequential mode: 2-3 Phantom popups (one per pool tx)
- Jito bundle mode: 1 Phantom popup (batch sign) + atomic submission

---

## Technical Details

### Jito Tip Injection (Backend)

```typescript
// In api/pool/create-phantom.ts
function addJitoTipToLastTransaction(
  transactions: Transaction[],
  feePayer: PublicKey,
  tipLamports: number = 5_000_000 // 0.005 SOL
): Transaction[] {
  const JITO_TIP_ACCOUNTS = [
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
    // ... other tip accounts
  ];
  const tipAccount = new PublicKey(
    JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]
  );
  
  const lastTx = transactions[transactions.length - 1];
  lastTx.add(
    SystemProgram.transfer({
      fromPubkey: feePayer,
      toPubkey: tipAccount,
      lamports: tipLamports,
    })
  );
  
  return transactions;
}
```

### Sequential Launch Flow (Frontend)

```typescript
// In TokenLauncher.tsx
for (let i = 0; i < txsToSign.length; i++) {
  const txLabel = txLabels[i];
  toast({ title: `Signing ${txLabel}...`, description: `Transaction ${i + 1} of ${txsToSign.length}` });
  
  const sig = await phantomWallet.signAndSendTransaction(txsToSign[i]);
  if (!sig) throw new Error(`${txLabel} failed or was rejected`);
  
  // Wait for confirmation before next tx
  await connection.confirmTransaction(sig, 'confirmed');
  signatures.push(sig);
}
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Default Mode | Jito bundle (failing) | Sequential signAndSendTransaction |
| Tip Placement | Separate first tx (wrong) | Embedded in last tx (correct) |
| Phantom Popups | 1 batch popup | 2-3 sequential popups |
| Reliability | Low (429 errors, timeouts) | High (Phantom handles retries) |
| Jito Bundle | Primary (broken) | Opt-in advanced feature |
| Blowfish Security | Bypassed | Working correctly |

This approach follows industry standards (pump.fun uses sequential, Meteora examples use sequential), ensures reliable on-chain landing, and maintains Blowfish security compliance per the project's Phantom verification requirements.

