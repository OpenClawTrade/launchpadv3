

## Problem Analysis

After deep investigation, the trade from the screenshot (TX: `4TvsEJhh...`) exists **nowhere** in the database — not in `alpha_trades`, not in `wallet_trades`, not in `launchpad_transactions`. The recording is silently failing across ALL layers.

**Root causes identified:**

1. **`recordAlphaTrade()` is fire-and-forget** — called without `await`, errors silently swallowed. If the browser navigates or garbage-collects before the HTTP request completes, the insert is lost.

2. **Edge function `launchpad-swap` alpha_only mode also fire-and-forget** — `.catch(() => {})` discards all errors.

3. **Missing trade paths** — Several components that execute trades do NOT call `recordAlphaTrade` at all:
   - `QuickTradeButtons.tsx` — has buy/sell but no alpha recording
   - `TradePanelWithSwap.tsx` — has buy/sell but no alpha recording
   - `BnbTradePanel.tsx` — relies solely on the edge function
   - `MobileTradePanelV2.tsx` — only records for non-bonding mode trades (bonding curve path skips recording)

4. **`fetch-wallet-transactions` sync misses trades** — The Helius enhanced API classifies many DeFi swaps as "receive" or "unknown" (as confirmed by the live API response showing only transfers). The `syncSwapsToAlphaTracker` function only processes `type === "swap"`, so most trades are never synced.

## Plan

### 1. Make `recordAlphaTrade` robust and awaited
**File: `src/lib/recordAlphaTrade.ts`**
- Add retry logic (2 attempts with 1s delay)
- Add more descriptive error logging
- Export as a reliable async function

### 2. Await `recordAlphaTrade` in all swap hooks
**Files: `src/hooks/useFastSwap.ts`**
- `await` the `recordAlphaTrade()` call in both `swapBondingCurve` and `executeFastSwap` graduated path
- This ensures the insert completes before the function returns

### 3. Add `recordAlphaTrade` to missing trade paths
**File: `src/components/launchpad/QuickTradeButtons.tsx`** — Add recording after successful buy/sell
**File: `src/components/launchpad/TradePanelWithSwap.tsx`** — Add recording after successful trade
**File: `src/components/launchpad/MobileTradePanelV2.tsx`** — Add recording in the bonding curve path (currently skipped when `isBondingMode` is true)

### 4. Fix `MobileTradePanelV2` bonding mode gap
**File: `src/components/launchpad/MobileTradePanelV2.tsx`**
- Currently, when `isBondingMode && bondingToken`, the trade executes via `executeRealSwap` but the `recordAlphaTrade` block is inside an `else` that only runs for non-bonding trades
- Move `recordAlphaTrade` call to run for ALL successful trades regardless of mode

### 5. Improve `fetch-wallet-transactions` swap detection
**File: `supabase/functions/fetch-wallet-transactions/index.ts`**
- Expand swap detection beyond just `type === "swap"` — also check for token transfers with corresponding SOL transfers (the DeFi swap pattern that Helius often classifies as "unknown")
- This acts as a secondary catch-all when the user opens their Panel

### 6. Backfill today's missing trades
**Database migration** — One-time query to sync any trades from `wallet_trades` that are missing from `alpha_trades` (the trigger should handle new ones, but existing gaps need filling)

