

## Revert Phantom Mode to 2-TX Launch Method

### Overview
The current Phantom launch uses a complex 3-transaction flow (Config, Pool, Dev Buy) with Jito bundles and `signAllTransactions` for Lighthouse chaining. Since `signAllTransactions` suggestions aren't working reliably in Phantom, we revert to a simpler **2-TX sequential sign-after-confirm** flow where the dev buy is merged back into the pool transaction.

### What Changes

**Backend: `api/pool/create-phantom.ts`**
- Set `skipDevBuyMerge = false` (always merge dev buy into pool TX instead of keeping it as separate TX3)
- Remove Jito tip injection logic (no longer needed without a separate dev buy TX)
- This means the backend always returns 2 transactions: TX1 (Create Config) + TX2 (Create Pool + Dev Buy merged)

**Frontend: `src/components/launchpad/TokenLauncher.tsx` (`handlePhantomLaunch`)**
- Remove the 3-TX Jito bundle code path (`if (useJitoBundle && txsToSign.length >= 3)`)
- Remove the 3-TX sequential code path (`else if (txsToSign.length >= 3)`)
- Keep only the 2-TX sequential sign-after-confirm loop (the existing `else` branch at line 1278-1288)
- Each TX is signed individually with `signTransaction` (one Phantom popup per TX), submitted, and confirmed before the next
- Remove `signAllTransactions` usage entirely from the Phantom launch flow
- Remove Jito bundle imports if no longer used elsewhere

**Frontend: `src/components/launchpad/TokenLauncher.tsx` (`handleHoldersLaunch`)**
- Same simplification: remove `signAllTransactions` handling, use the 2-TX sequential loop

**No changes to `fun-phantom-create` edge function** (it just proxies to the Vercel API and returns whatever transactions come back)

### Flow After Change

```text
1. User clicks Launch
2. Backend prepares 2 unsigned TXs: Config + Pool (with dev buy merged)
3. Frontend: sign TX1 via signTransaction -> submit -> wait for confirmed
4. Frontend: 2s sync buffer
5. Frontend: sign TX2 via signTransaction -> submit -> wait for confirmed
6. Frontend: Phase 2 DB record
```

### Technical Details

**`api/pool/create-phantom.ts`:**
- Line 243: Change `const skipDevBuyMerge = effectiveDevBuySol > 0;` to `const skipDevBuyMerge = false;`
- Remove the `addJitoTipToLastTx` call and related imports/function (lines ~30-56)

**`src/components/launchpad/TokenLauncher.tsx` (`handlePhantomLaunch`):**
- Remove lines ~1199-1288 (the 3-TX Jito and 3-TX sequential branches)
- Keep only the simple sequential loop (lines 1278-1288 become the sole path)
- Remove `submitJitoBundle`, `waitForBundleConfirmation`, `createJitoTipInstruction`, `getRandomTipAccount` imports if unused elsewhere

**`src/components/launchpad/TokenLauncher.tsx` (`handleHoldersLaunch`):**
- Simplify to use the same 2-TX sequential sign-after-confirm pattern (replace the current for-loop at lines 804-838)

