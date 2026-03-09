

# Alpha Tracker — Detailed Trade Analytics with Holding Status & PnL

## Current State
- `alpha_trades` table stores individual buy/sell events with: wallet, token, SOL amount, token amount, trade_type, tx_hash, timestamp
- No `price_usd` is recorded (always null), no holding status or PnL tracking
- UI is a flat list of trade rows with minimal info

## Plan

### 1. Add `price_sol` column to `alpha_trades` table
- Store the token's price_sol at time of trade (already available in the edge function)
- This enables accurate PnL calculations

**Migration:**
```sql
ALTER TABLE public.alpha_trades ADD COLUMN price_sol NUMERIC;
```

### 2. Update edge function to record `price_sol`
- In `launchpad-swap/index.ts`, pass `newPrice` (already computed) into the alpha_trades insert

### 3. Compute holding status & PnL client-side
- In `useAlphaTrades`, group all trades by `(wallet_address, token_mint)` to build a position summary per trader/token:
  - **Total bought** (sum of buy amounts in SOL & tokens)
  - **Total sold** (sum of sell amounts in SOL & tokens)
  - **Net tokens remaining** = bought_tokens - sold_tokens
  - **Still holding?** = net_tokens > 0
  - **Realized PnL** = sell_sol_total - (buy_avg_price × sold_tokens)
  - **Status badge**: "HOLDING" (green), "SOLD" (red/neutral), "PARTIAL" (yellow)

### 4. Redesign Alpha Tracker UI
Transform from simple list to a detailed trade feed with expandable rows:

**Each trade row shows:**
- Trader avatar + name
- BUY/SELL badge
- Token ticker (linked to trade page)
- SOL amount + token amount
- Price per token at time of trade
- Exact timestamp (e.g. "Mar 6, 4:40 PM") + relative time ("2d ago")
- TX link to Solscan

**Position status section (right side of row):**
- Holding status badge: "HOLDING 🟢" / "SOLD 🔴" / "PARTIAL 🟡"
- If holding: show remaining token count
- If sold (partially or fully): show realized PnL in SOL with +/- color
- Net position as a compact line: "Bought 2.5 SOL → Sold 1.8 SOL → PnL: +0.3 SOL"

### 5. Files to modify
1. **Migration** — add `price_sol` column
2. **`supabase/functions/launchpad-swap/index.ts`** — record `price_sol: newPrice` in both alpha_trades insert sites
3. **`src/hooks/useAlphaTrades.ts`** — add `price_sol` to interface, add position computation helper that groups trades
4. **`src/pages/AlphaTrackerPage.tsx`** — redesign UI with detailed rows showing timestamps, PnL, holding status badges, and enriched trade data

