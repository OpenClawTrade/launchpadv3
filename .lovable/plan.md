

## Bug: "YOUR TRADES" tab shows no trades for external tokens

### Root Cause

The `TokenDataTabs` component is used in two code paths in `FunTokenDetailPage.tsx`:

1. **External/Codex-only tokens** (lines ~243, 254, 279): `<TokenDataTabs tokenAddress={mintAddress} holderCount={token.holders} />` — **missing `userWallet` and `currentPriceUsd` props**
2. **Known (DB) tokens** (lines ~846, 863, 890): `<TokenDataTabs ... userWallet={solanaAddress || undefined} currentPriceUsd={codexPrice || 0} />` — props correctly passed

When `userWallet` is `undefined`, the filtering logic in `TokenDataTabs` produces an empty array:
```ts
const userTrades = userWallet
  ? events.filter(e => e.maker.toLowerCase() === userWallet.toLowerCase())
  : []; // always empty when userWallet is undefined
```

### Fix

Pass `userWallet={solanaAddress || undefined}` and `currentPriceUsd` to all three external-token `TokenDataTabs` usages (lines ~243, 254, 279) — the same way it's done for the known-token branch.

This is a 3-line fix in `FunTokenDetailPage.tsx`. The `solanaAddress` variable is already available in scope from `useAuth()`.

### Files to Modify
- `src/pages/FunTokenDetailPage.tsx` — add missing `userWallet` and `currentPriceUsd` props to the 3 external-token `TokenDataTabs` calls

