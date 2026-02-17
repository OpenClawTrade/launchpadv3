

## Fix: Use signTransaction + sendRawTransaction Instead of signAndSendTransaction

### The Real Problem

`signAndSendTransaction` tells Phantom to **send the transaction through Phantom's own RPC node**. Your code then polls **your Helius RPC** for the signature. Helius never saw that transaction because it was submitted elsewhere. 30 polls, 90 seconds, nothing found. The transaction probably landed on-chain just fine — your RPC simply never indexed it.

This is not an RPC reliability issue. This is a routing issue. Two different pipes.

### The Fix (one change, solves everything)

**Stop using `signAndSendTransaction`. Use `signTransaction` instead.**

Flow becomes:
1. Phantom signs the transaction (adds Lighthouse instructions) — returns signed TX, does NOT send it
2. Frontend applies ephemeral keypair signatures (mint, config)
3. Frontend sends via `connection.sendRawTransaction` through YOUR Helius RPC
4. Frontend confirms via YOUR Helius RPC — same pipe, instant visibility

### Balance Check Cleanup

Remove the 3-RPC parallel race for balance. You have paid Helius — just use it. One call, fast. If it fails, fall back to the cached balance from the hook. No publicnode, no solana-mainnet.

### Files Changed

| File | Change |
|------|--------|
| `src/components/launchpad/TokenLauncher.tsx` | Replace `signAndSendTx` to use `signTransaction` + `sendRawTransaction`; simplify balance check to single Helius call; simplify `confirmTx` since same-RPC confirmation is reliable |

### Technical Detail

**`signAndSendTx` replacement (lines ~1194-1227):**

```text
OLD:
  1. Inject fresh blockhash
  2. Apply ephemeral keypair signatures
  3. phantomWallet.signAndSendTransaction(tx) — Phantom sends via ITS RPC
  4. Return signature

NEW:
  1. Inject fresh blockhash from Helius
  2. Apply ephemeral keypair signatures  
  3. phantomWallet.signTransaction(tx) — Phantom signs only, does NOT send
  4. connection.sendRawTransaction(signedTx.serialize()) — sent via YOUR Helius
  5. Return signature
```

**`confirmTx` simplification (lines ~1230-1298):**

Since the transaction is now sent through the same Helius RPC that confirms it, the WebSocket confirmation will work reliably. Keep polling as a safety net but it should rarely be needed.

**Balance check (lines ~1012-1052):**

Replace 3-endpoint parallel race with single `connection.getBalance(walletPubkey)` call. Fall back to cached `phantomWallet.balance` if it fails. One RPC, zero delay.

### What This Means

- Signing prompt appears instantly (no multi-RPC balance race)
- Confirmation works every time (same RPC sends and confirms)
- No more "not found yet" polls — Helius sees its own transactions immediately
- Dev buy stays merged in TX2 (2-transaction flow unchanged)
- Lighthouse protection still works (signTransaction triggers it too)

