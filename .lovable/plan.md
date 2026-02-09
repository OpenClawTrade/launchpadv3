
# Mobile UI Fixes + Jupiter Limit Orders for Trading Agents

## Part 1: Mobile UI Improvements

The screenshot shows the SubTuna page (/t/67) on mobile with elements being cut off (the "Trade $6..." button is truncated). After reviewing all relevant pages, here are the mobile issues and fixes needed:

### TokenStatsHeader (src/components/tunabook/TokenStatsHeader.tsx)
- The header row has buttons that overflow on mobile. The "Trading Agent" and "Trade $TICKER" buttons get cut off.
- **Fix**: Stack the header vertically on mobile. Move action buttons below the token info. Use smaller button text on mobile. Wrap buttons to a new line.

### SubTunaPage (src/pages/SubTunaPage.tsx)
- The community header section (`flex items-end gap-4`) doesn't wrap well on small screens - avatar, name, and join button fight for space.
- Quick stats row (`flex items-center gap-6`) overflows horizontally on small screens.
- **Fix**: Make header stack vertically on mobile. Wrap quick stats into a grid on mobile.

### TradingAgentProfilePage (src/pages/TradingAgentProfilePage.tsx)
- Stats cards use `grid-cols-2 md:grid-cols-5` -- 5 cards in a row is fine on desktop but 2 columns with 5 items leaves an orphan card.
- Open positions grid uses `grid-cols-4` which is too cramped on mobile (Entry, Current, Investment, P&L all in one row).
- Trade history grid uses `grid-cols-3` -- tight on mobile.
- Tabs list with 4 items (Strategy, Positions, History, Insights) overflows on small screens.
- **Fix**: Use `grid-cols-2` for position details on mobile, stack trade history vertically, make tabs scrollable horizontally.

### TradingAgentsPage (src/pages/TradingAgentsPage.tsx)
- The sidebar (Create Agent, Technical Architecture, Agent Lifecycle) takes 1/3 width on desktop but on mobile it stacks below the main content which is fine, but the `lg:grid-cols-3` layout means on tablets it might look cramped.
- Tab bar with "Full Leaderboard" button may overflow on mobile.
- **Fix**: Ensure tab bar wraps properly. Make "Full Leaderboard" button smaller or move below tabs on mobile.

### TradingAgentCard (src/components/trading/TradingAgentCard.tsx)
- Generally looks okay but the strategy badge text can overflow.
- **Fix**: Hide strategy text on very small screens, show icon only.

---

## Part 2: Jupiter Limit Orders (On-Chain SL/TP)

Replace the internal DB-based SL/TP monitoring with Jupiter's Trigger Order API (`/trigger/v1/createOrder`) so that stop-loss and take-profit orders persist on-chain and execute automatically via Jupiter's keeper network, regardless of whether the backend is running.

### How It Works

1. **On Entry (trading-agent-execute)**: After the buy swap succeeds and the agent receives tokens, immediately place TWO on-chain limit orders via Jupiter Trigger API:
   - **Stop-Loss Order**: Sell all tokens if price drops to SL level
   - **Take-Profit Order**: Sell all tokens if price rises to TP level

2. **On Trigger Execution**: When either SL or TP hits, Jupiter's keeper network auto-executes the sell. The monitor function detects closed orders and updates the database accordingly.

3. **On Manual Exit or Opposite Trigger**: When one order fills, cancel the other unfilled order via Jupiter's `/trigger/v1/cancelOrder` endpoint.

### Technical Changes

#### trading-agent-execute/index.ts
- After successful buy swap, calculate SL and TP prices from entry price
- Call `POST https://api.jup.ag/trigger/v1/createOrder` twice (SL + TP orders)
- Sign and submit both order transactions
- Store `limit_order_sl_pubkey` and `limit_order_tp_pubkey` in `trading_agent_positions` table

#### trading-agent-monitor/index.ts
- Instead of checking prices and executing sells, check order status via `GET https://api.jup.ag/trigger/v1/getOrder?account={orderPubkey}`
- If an order is filled: update position as closed, cancel the counterpart order
- If an order is cancelled externally: log and handle gracefully
- Keep price update logic for UI display purposes, but remove the sell execution logic

#### Database Migration
- Add columns to `trading_agent_positions`:
  - `limit_order_sl_pubkey` (text, nullable) -- on-chain SL order address
  - `limit_order_tp_pubkey` (text, nullable) -- on-chain TP order address
  - `limit_order_sl_status` (text, default 'pending') -- 'pending', 'filled', 'cancelled'
  - `limit_order_tp_status` (text, default 'pending') -- 'pending', 'filled', 'cancelled'

#### Jupiter Trigger API Endpoints Used
- `POST /trigger/v1/createOrder` -- Create limit sell order with target price
- `POST /trigger/v1/cancelOrder` -- Cancel unfilled order when counterpart fills
- `POST /trigger/v1/execute` -- Submit signed transaction
- `GET /trigger/v1/getOrder` -- Check order status

### Fallback Strategy
If Jupiter Limit Order creation fails (e.g., token not supported), fall back to the current DB-based monitoring approach for that specific position. The `limit_order_sl_pubkey` being null indicates fallback mode.

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/tunabook/TokenStatsHeader.tsx` | Mobile-responsive header layout |
| `src/pages/SubTunaPage.tsx` | Mobile-responsive community header and stats |
| `src/pages/TradingAgentProfilePage.tsx` | Mobile-responsive grids, tabs, position details |
| `src/pages/TradingAgentsPage.tsx` | Mobile-responsive tab bar and sidebar |
| `src/components/trading/TradingAgentCard.tsx` | Minor mobile badge overflow fix |
| `supabase/functions/trading-agent-execute/index.ts` | Add Jupiter Limit Order creation after buy |
| `supabase/functions/trading-agent-monitor/index.ts` | Replace sell execution with order status polling + cancellation |
| Database migration | Add limit order tracking columns |
