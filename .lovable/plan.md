

# Fix: Trading Agent Stats Not Updating (PNL, Win Rate, Avg Hold Time)

## Problem

The force-sell operation sold the agent's positions but never updated the agent's performance stats in the `trading_agents` table. The columns `total_profit_sol`, `win_rate`, `winning_trades`, `losing_trades`, and `avg_hold_time_minutes` are all still 0.

The normal monitor function has this stat-update logic (around line 1212-1258 of `trading-agent-monitor/index.ts`), but `trading-agent-force-sell` skips it entirely.

## Fix (2 parts)

### Part 1: One-time DB correction for the existing trade

Run a SQL update to fix the current agent's stats based on the completed trade:
- Buy: 0.62428 SOL
- Sell: 0.45650 SOL
- P&L: -0.16778 SOL (loss)
- Hold time: ~18 minutes
- Result: 0W / 1L, win rate 0%

Update `trading_agents` row directly with correct values.

### Part 2: Add stat-update logic to `trading-agent-force-sell`

After each successful sell in the force-sell function, calculate and update the agent's stats:

1. Look up the matching buy trade from `trading_agent_trades` for the sold token
2. Calculate P&L (sell amount - buy amount)
3. Calculate hold time (sell time - buy time)
4. Update `trading_agents` table with:
   - `total_profit_sol` incremented by P&L
   - `winning_trades` or `losing_trades` incremented
   - `win_rate` recalculated
   - `avg_hold_time_minutes` updated
   - `best_trade_sol` / `worst_trade_sol` updated if applicable

This mirrors the same logic from `trading-agent-monitor/index.ts` lines 1212-1258.

---

### Technical Details

**File changes:**
- `supabase/functions/trading-agent-force-sell/index.ts` -- Add a new helper function `updateAgentStats()` that:
  - Queries `trading_agent_trades` for the buy record matching the token
  - Computes P&L and hold time
  - Reads current agent stats
  - Writes updated stats atomically
  - Call this function after each successful sell result

**Database fix (one-time migration):**
```sql
UPDATE trading_agents
SET total_profit_sol = -0.16778,
    winning_trades = 0,
    losing_trades = 1,
    win_rate = 0,
    total_trades = 1,
    avg_hold_time_minutes = 18,
    worst_trade_sol = -0.16778
WHERE id = '1776eabc-5e58-46e2-be1d-5300dd202b51';
```

