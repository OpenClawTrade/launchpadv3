

## Phantom Lighthouse Integration - Remove Security Warnings

### Problem
Phantom wallet shows security warnings during token launches because the current flow uses `signAndSendTransaction`, which doesn't give Phantom room to inject its Lighthouse protection instructions into multi-signer transactions.

### Solution
Switch from `signAndSendTransaction` to `signTransaction` across all Phantom launch flows, then submit transactions via our own RPC. This lets Phantom add Lighthouse instructions and sign the transaction, eliminating warnings.

### Changes Required

#### 1. Update `TokenLauncher.tsx` - Main Phantom Launch Flow (lines ~1034-1099)
- Replace `signAndSendTransaction` with `signTransaction` for each transaction
- After Phantom signs (adding Lighthouse instructions), serialize and submit via our own Helius RPC using `sendRawTransaction`
- Keep the existing sequential flow and confirmation polling logic

#### 2. Update `TokenLauncher.tsx` - Holders Launch Flow (lines ~786-800)
- Same change: replace `signAndSendTransaction` with `signTransaction` + manual RPC submission

#### 3. Update `ClaudeLauncherPage.tsx` - Claude Launcher Phantom Flow (lines ~576-603)
- This page already uses `signTransaction` + manual RPC send, so it should already work correctly with Lighthouse
- Verify and ensure consistency with the other flows

#### 4. Transaction Size Consideration
- If any transactions are near the 1232-byte limit, implement Address Lookup Tables (ALTs) on the backend to compress the transaction size and leave room for Phantom's Lighthouse instructions
- If transactions exceed Compute Unit limits, split them (this is already done -- Config + Pool are separate transactions)

### Technical Details

The core change in each launch flow replaces:
```typescript
// OLD: Phantom signs AND sends (no room for Lighthouse)
const signature = await phantomWallet.signAndSendTransaction(tx);
```

With:
```typescript
// NEW: Phantom signs only (adds Lighthouse instructions), we send
const signedTx = await phantomWallet.signTransaction(tx);
if (!signedTx) throw new Error("Signing cancelled");

const rawTx = signedTx.serialize();
const { url: rpcUrl } = getRpcUrl();
const connection = new Connection(rpcUrl, "confirmed");
const signature = await connection.sendRawTransaction(rawTx, {
  skipPreflight: false,
  preflightCommitment: "confirmed",
  maxRetries: 3,
});
```

Files modified:
- `src/components/launchpad/TokenLauncher.tsx` (2 flows: Phantom + Holders)
- `src/pages/ClaudeLauncherPage.tsx` (verify already correct)

