

## Root Cause: Ephemeral Signatures Lost — Signing Order Bug

### What's Actually Happening

The transaction is being **sent to Helius just fine**. Helius accepts it into its mempool. But **validators silently drop it** because it has **missing signatures**.

Here's the bug:

1. Lines 1182-1192: Ephemeral keypairs (mint, config) call `partialSign()` on the transaction **BEFORE** Phantom
2. Line 1195: Phantom's `signTransaction()` receives the transaction, deserializes it internally using **its own bundled @solana/web3.js**, adds its signature, and returns a **new object**
3. Phantom's cross-realm deserialization **strips the ephemeral signatures** that were applied in step 1
4. The transaction is serialized and sent with only Phantom's signature — missing the required ephemeral ones
5. Validators see missing required signers and silently drop the transaction
6. Polling returns `null` forever because the transaction never landed

This is why `skipPreflight: true` hides the error — preflight simulation would have caught "missing required signature". And it's why you see the transaction "sent" but never "found".

There's even a dead function `applyEphemeralSigs` at line 1144 that was meant to fix this — it applies signatures AFTER Phantom — but it's never called. The old pre-Phantom signing at 1182-1192 is still doing the work.

### The Fix

**Sign ephemeral keys AFTER Phantom returns the signed transaction, not before.** Use duck-typing to handle the cross-realm `instanceof` issue.

### Changes in `src/components/launchpad/TokenLauncher.tsx`

**1. Remove pre-Phantom ephemeral signing (lines 1182-1192)**

Delete the block that calls `partialSign` / `sign` before Phantom.

**2. After Phantom signs (line 1195-1196), apply ephemeral signatures using duck-typing**

```text
const signedTx = await phantomWallet.signTransaction(tx);

// Apply ephemeral sigs AFTER Phantom (cross-realm safe)
const neededPubkeys = txRequiredKeypairs[idx] || [];
const localSigners = neededPubkeys
  .map(pk => ephemeralKeypairs.get(pk))
  .filter(Boolean);

if (localSigners.length > 0) {
  if (typeof signedTx.partialSign === 'function') {
    signedTx.partialSign(...localSigners);   // Legacy Transaction
  } else if (typeof signedTx.sign === 'function') {
    signedTx.sign(localSigners);             // VersionedTransaction
  }
}
```

**3. Fix serialization to also use duck-typing (lines 1199-1203)**

```text
const rawTx = typeof signedTx.serialize === 'function'
  ? signedTx.serialize()
  : Buffer.from(signedTx.serialize());
```

**4. Remove dead `applyEphemeralSigs` function (lines 1144-1162)**

It's unused. Clean it up.

### Why This Is The Real Fix

- Phantom can't strip signatures that don't exist yet when it signs
- Ephemeral keys sign the exact same message bytes (blockhash hasn't changed)
- Duck-typing avoids all cross-realm `instanceof` failures
- The transaction arrives at validators with ALL required signatures
- `sendRawTransaction` via Helius still works — same-pipe confirmation stays reliable

### Files Changed

| File | Change |
|------|--------|
| `src/components/launchpad/TokenLauncher.tsx` | Move ephemeral signing after Phantom; duck-type everything; remove dead code |

