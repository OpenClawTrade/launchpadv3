

# Fix TX1 Confirmation + Phantom Lighthouse Red Warning

## Root Cause

Two linked issues prevent clean launches:

1. **TX1 never confirms** -- The manual `getSignatureStatuses` polling loop is unreliable and there is no transaction rebroadcasting. If the first send is dropped during congestion, the transaction never lands.
2. **TX2 shows red "unsafe" warning** -- Even when TX1 does confirm, Phantom's internal RPC may not have synced TX1's state yet. When Phantom simulates TX2, it cannot find the config account TX1 created, so Lighthouse flags it as unsafe.

Both must be fixed together: TX1 must land reliably, AND Phantom must see its effects before TX2 is presented for signing.

## Changes (single file: `src/components/launchpad/TokenLauncher.tsx`)

### 1. Replace manual polling with `confirmTransaction` + rebroadcasting

The current `submitAndConfirmRpc` function (lines ~1166-1203) uses a manual `getSignatureStatuses` loop with 600ms intervals. Replace with:

- **`connection.confirmTransaction()`** using the blockhash strategy -- this is Solana's recommended approach and handles edge cases (expired blockhash, dropped transactions) automatically.
- **Parallel rebroadcast loop** -- resend the raw signed transaction every 3 seconds while waiting for confirmation. This is standard Solana best practice for reliable transaction landing.

```text
BEFORE:
  sendRawTransaction → poll getSignatureStatuses every 600ms → timeout after 45s

AFTER:
  sendRawTransaction → rebroadcast every 3s in parallel → confirmTransaction (blockhash strategy) → clear rebroadcast
```

### 2. Increase post-confirmation sync buffer

After TX1 is confirmed, increase the buffer from 1 second to 2 seconds. This gives Phantom's RPC nodes time to sync TX1's state before the dApp requests batch-signing of TX2+TX3. The `signAllTransactions` call (which chains TX2 and TX3 simulation together per Phantom docs) will only succeed if Phantom's simulator can see the config account TX1 created.

### 3. Remove dead frontend priority fee code

The priority fee injection code added at lines 1087-1100 is dead code -- all transactions are VersionedTransactions (v0), so the `tx instanceof Transaction` check always fails. The backend (`lib/meteora.ts`) already sets 500,000 microLamports priority fees. Remove this block and the unused `ComputeBudgetProgram` import.

### 4. Keep transaction size diagnostics

The byte-size logging (lines 1102-1120) is useful for ongoing monitoring and stays.

## How this follows Phantom's documentation

Per Phantom's multi-signer docs:
- **`signTransaction(TX1)`** -- Phantom signs first, adds Lighthouse instructions, dApp signs with ephemeral keys, submits via own RPC. (Already correct, just needs reliable confirmation.)
- **`signAllTransactions([TX2, TX3])`** -- Phantom signs both, adds Lighthouse to both, chains simulation so TX3 sees the pool TX2 creates. dApp applies ephemeral sigs after. (Already correct, but TX2 simulation fails because TX1's state hasn't propagated.)
- **Address Lookup Table** -- Already in use, providing 466-577 bytes of headroom per the diagnostics. (No changes needed.)
- **dApp submits via own RPC** -- Never uses `signAndSendTransaction`. (Already correct.)

## Technical Details

### New `submitAndConfirmRpc` implementation

```typescript
const submitAndConfirmRpc = async (signedTx, label) => {
  const rawTx = signedTx.serialize();
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');

  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 0, // We handle retries ourselves
  });
  signatures.push(signature);

  // Rebroadcast every 3s in parallel (standard Solana best practice)
  const resendInterval = setInterval(async () => {
    try {
      await connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 0,
      });
    } catch {}
  }, 3000);

  try {
    // Blockhash-based confirmation (handles expiry automatically)
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`${label} failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
    }
  } finally {
    clearInterval(resendInterval);
  }

  // 2s buffer for Phantom's RPC to sync TX1's state
  await new Promise(r => setTimeout(r, 2000));
  return signature;
};
```

### Lines affected

| Lines | Change |
|-------|--------|
| 16 | Remove `ComputeBudgetProgram` from import |
| 1087-1100 | Delete dead priority fee injection block |
| 1166-1203 | Replace `submitAndConfirmRpc` with rebroadcast + `confirmTransaction` approach |

No other files need changes. The signing flow (signTransaction for TX1, signAllTransactions for TX2+TX3, ephemeral keys applied after Phantom) remains exactly as-is.
