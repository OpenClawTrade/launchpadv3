

## Plan: Fix Alpha Tracker to Record All Trades Across the Platform

### Root Cause

The alpha_trades recording has **two paths** and one of them is broken:

1. **`alpha_only` mode** — works correctly. Used by `UniversalTradePanel` and `MobileTradePanelV2` after client-side swaps. Doesn't require the token to exist in the `tokens` table.

2. **`record` mode** — broken for external tokens. The `launchpad-swap` edge function does a `tokens` table lookup at line 102 and returns **404** if the token isn't found. The alpha_trades insert at line 257 never executes. This affects:
   - All Quick Buy/Sell from Pulse cards (`PulseQuickBuyButton`)  
   - All graduated/Jupiter swaps via `useFastSwap.swapGraduated()`
   - Any trade on tokens not in the DB `tokens` table

### Fix Strategy

**Add a client-side `alpha_only` fallback** after every successful trade that doesn't already have one. This is simpler and more reliable than modifying the edge function's `record` mode.

### Changes

#### 1. `src/hooks/useFastSwap.ts` — Add alpha_only recording after graduated swaps
After `swapGraduated` returns successfully (line 198-211), add an `alpha_only` call alongside the existing `record` call. The `alpha_only` path doesn't require the token to be in the DB.

```typescript
// After graduated swap succeeds, record alpha trade (alpha_only mode works for any token)
supabase.functions.invoke('launchpad-swap', {
  body: {
    mintAddress: token.mint_address,
    userWallet: walletAddress,
    amount,
    isBuy,
    profileId: profileId || undefined,
    signature: result.signature,
    outputAmount: isBuy ? result.tokensOut : result.solOut,
    tokenName: token.name,
    tokenTicker: token.ticker,
    mode: 'alpha_only',
  },
}).catch(() => {});
```

Also add the same for bonding curve swaps (line 132-145) as a safety net — if `mode: 'record'` fails due to token not found, the `alpha_only` call still records it.

#### 2. `src/hooks/useFastSwap.ts` — Deduplicate alpha_trades
To prevent double-inserts (since `record` mode also inserts into alpha_trades when it succeeds), add a unique constraint check. The edge function's `alpha_only` path should use `upsert` or the DB should have a unique index on `tx_hash`.

#### 3. Database Migration — Add unique index on `alpha_trades.tx_hash`
```sql
CREATE UNIQUE INDEX IF NOT EXISTS alpha_trades_tx_hash_unique ON public.alpha_trades (tx_hash);
```
This prevents duplicate entries when both `record` and `alpha_only` calls succeed.

#### 4. `supabase/functions/launchpad-swap/index.ts` — Use upsert for alpha_trades inserts
Change all `alpha_trades` `.insert()` calls to `.upsert()` with `onConflict: 'tx_hash'` to gracefully handle duplicates instead of erroring.

#### 5. `supabase/functions/bnb-swap/index.ts` — Enrich BNB alpha_trades records  
Add `token_name`, `token_ticker`, `trader_display_name`, `trader_avatar_url` fields to the BNB swap alpha_trades insert (line 663). The token name/ticker are already available from the token lookup earlier in the function.

#### 6. `src/components/launchpad/PulseQuickBuyButton.tsx` — No changes needed
The quick buy flows through `useTurboSwap` → `useFastSwap`, so fixing `useFastSwap` covers all Pulse quick buy/sell trades automatically.

### Summary of Trade Recording Coverage After Fix

| Trade Source | Solana | BNB |
|---|---|---|
| UniversalTradePanel | ✅ alpha_only | N/A |
| MobileTradePanelV2 | ✅ alpha_only | N/A |
| Pulse Quick Buy/Sell | ✅ fixed via useFastSwap | ✅ already works |
| Portfolio Sell | ✅ fixed via useFastSwap | N/A |
| Bonding Curve swap | ✅ record + alpha_only fallback | N/A |
| Graduated/Jupiter swap | ✅ new alpha_only call | N/A |
| BNB swap | N/A | ✅ enriched with names |

### Files to Change
1. **DB migration** — unique index on `alpha_trades.tx_hash`
2. **`src/hooks/useFastSwap.ts`** — add `alpha_only` calls after all swap paths
3. **`supabase/functions/launchpad-swap/index.ts`** — change `.insert()` to `.upsert()` for alpha_trades
4. **`supabase/functions/bnb-swap/index.ts`** — enrich alpha_trades with token name/ticker/trader info

