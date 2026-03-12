

## Plan: Fix Duplicate Trending Coins in Ticker Bar

**Problem**: The `useTickerTokens` hook fetches 15 tokens sorted by `created_at`, but the database can contain multiple tokens with the same ticker (e.g., "CHICKEN" appears twice). The ticker bar then duplicates the array 4x for the scroll animation, making duplicates very visible.

**Fix**: Deduplicate tokens by ticker in `TokenTickerBar.tsx` before the 4x repeat. Keep only the first (newest) occurrence of each ticker.

### File: `src/components/launchpad/TokenTickerBar.tsx`

- After getting `tokens` from the hook, deduplicate by `ticker` using a Set:
```typescript
const uniqueTokens = tokens.filter((t, i, arr) => 
  arr.findIndex(x => x.ticker === t.ticker) === i
);
const displayTokens = [...uniqueTokens, ...uniqueTokens, ...uniqueTokens, ...uniqueTokens];
```

Single file change, ~2 lines modified.

