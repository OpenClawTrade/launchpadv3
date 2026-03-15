

## Fix Token Holdings: Add Sell 100%, Trade Button & USD Values

### Problem
The wallet section in `/panel` shows token holdings with only the raw balance. Missing:
1. **"Sell 100%"** button — inline on each token row
2. **"Trade"** button — to navigate to the token's trade page
3. **USD value** — current dollar value of each holding

### Approach

**`src/components/wallet/TokenHoldingsList.tsx`** — Major update:

1. **Add USD values**: Import `useSolPrice` hook. The `useTokenMetadata` doesn't return prices, so we need token prices. Two options:
   - For platform tokens (in `fun_tokens`/`tokens` tables): use `market_cap_sol` / `total_supply` to get price per token
   - For all tokens: use a lightweight price lookup via Codex/Jupiter

   Best approach: Extend the existing `fetch-token-metadata` edge function to also return `price_usd` per mint (via Jupiter Price API which is free), OR create a new `useTokenPrices` hook that batch-fetches prices. Jupiter Price API v2 supports batch mint lookups.

   **Simpler approach**: Use SOL price × token-price-in-SOL. We can get token prices from Jupiter Price API in a new edge function or extend `fetch-token-metadata`.

2. **Add "Sell 100%" button**: Use `useTurboSwap` hook (already used in Portfolio page for the same purpose). Each token row gets a red "Sell 100%" button that executes a full sell via the turbo swap pipeline.

3. **Add "Trade" button**: Navigate to `/token/{mintAddress}` using `useNavigate`.

4. **Layout change**: Remove the expand-to-see-actions pattern. Instead, show buttons inline on each row:
   - Left: icon + name/symbol
   - Middle: balance + USD value below
   - Right: "Trade" and "Sell 100%" buttons side by side (compact on mobile)

### New props needed on `TokenHoldingsList`:
- No new props needed — `useTurboSwap`, `useSolPrice`, and `useNavigate` can be imported directly

### New edge function or hook for token USD prices:
Create **`src/hooks/useTokenPrices.ts`** — batch-fetches USD prices for a list of mints from Jupiter Price API v2 via a lightweight edge function **`fetch-token-prices`** (to avoid CORS). Cached with 30s stale time.

### Files to create/modify

| File | Change |
|------|--------|
| `supabase/functions/fetch-token-prices/index.ts` | New — batch Jupiter Price API v2 lookup for mint addresses, returns `{ prices: { [mint]: number } }` |
| `src/hooks/useTokenPrices.ts` | New — hook wrapping the edge function with react-query |
| `src/components/wallet/TokenHoldingsList.tsx` | Add inline Sell 100% + Trade buttons, show USD values, use `useTurboSwap` for sells |

### UI Layout per token row (no expand needed)
```text
[icon] Name        balance     [$USD]   [Trade] [Sell 100%]
       SYMBOL
```
On mobile, buttons stack or shrink to icons. SOL row gets no Sell button (just Trade → navigates to SOL swap).

### Sell 100% flow
- Uses `useTurboSwap.executeTurboSwap()` with the token's full balance
- Shows loading spinner on the button during execution
- Toast on success/failure
- Auto-refetches holdings after sell

