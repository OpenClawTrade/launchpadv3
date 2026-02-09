

# Fix: Open Positions PnL Not Updating

## Problem
Both open positions (Cube and PSX) show 0% PnL because token prices never update. The `current_price_sol` is stuck at the `entry_price_sol` value.

**Root cause**: The `fetchTokenPrices` function in `trading-agent-monitor/index.ts` uses two price sources that both fail:
1. **Jupiter V6 Price API** (`price.jup.ag/v6/price`) -- This API is sunset/deprecated. Fails every cycle (confirmed in logs: "Jupiter SOL price fetch failed")
2. **pump.fun reserves API** -- Returns no usable data for these tokens (likely graduated to Meteora DBC)

SOL price fetching works fine via CoinGecko/Binance fallbacks -- only the per-token price resolution is broken.

## Solution

Update two functions in `supabase/functions/trading-agent-monitor/index.ts`:

### 1. Replace `fetchTokenPrices` (lines 439-481)

New price resolution order:
1. **Jupiter V2 Price API** (`api.jup.ag/price/v2`) -- The current working version, returns USD prices
2. **DexScreener API** (`api.dexscreener.com/latest/dex/tokens/{address}`) -- Reliable for pump.fun and Meteora tokens, returns `priceNative` (SOL-denominated)
3. **pump.fun API** -- Keep as last resort for pre-graduation tokens
4. **Log warning** if no price found for a token (currently fails silently)

### 2. Update `fetchSolPrice` (lines 485-543)

Replace the dead Jupiter V6 call with:
1. **Jupiter V2 Price API** (`api.jup.ag/price/v2?ids=So111...`) -- working endpoint
2. Keep CoinGecko, Binance, and Pyth fallbacks as-is

### Technical Details

```text
fetchTokenPrices changes:
- Line 450: Replace price.jup.ag/v6/price with api.jup.ag/price/v2?ids={address}
- Add DexScreener as second source using priceNative field
- Add console.warn when no price found for a token

fetchSolPrice changes:
- Line 488: Replace price.jup.ag/v6/price with api.jup.ag/price/v2?ids=So111...
```

### Files Modified
- `supabase/functions/trading-agent-monitor/index.ts`

### Expected Outcome
After deployment, the monitor will successfully fetch current prices for Cube and PSX tokens. The `unrealized_pnl_sol` and `unrealized_pnl_pct` columns will update every 5-second polling cycle, and the UI will display accurate PnL values.

