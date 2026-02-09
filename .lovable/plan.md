
## Complete Trading Agent Reset + Jupiter API Fix

### Part 1: Fix Jupiter 404 Errors

The monitor function is calling `/trigger/v1/getOrders` which does not exist. The correct Jupiter Trigger API endpoint is `/trigger/v1/getTriggerOrders`.

**Changes in `supabase/functions/trading-agent-monitor/index.ts`:**

| Current (broken)                                      | Correct                                                                  |
|-------------------------------------------------------|--------------------------------------------------------------------------|
| `/trigger/v1/getOrders?account=...`                   | `/trigger/v1/getTriggerOrders?user=...&orderStatus=active`               |
| `/trigger/v1/getOrders?account=...&includeHistory=true`| `/trigger/v1/getTriggerOrders?user=...&orderStatus=history`             |

The parameter name also changes from `account` to `user`, and filtering is done via `orderStatus=active` or `orderStatus=history` instead of `includeHistory=true`.

This fix alone will eliminate the flood of 404 errors shown in the screenshot.

---

### Part 2: Force-Sell ALL Wallet Tokens (Not Just DB Positions)

The current `trading-agent-force-sell` function only sells tokens tracked in the `trading_agent_positions` table. But the wallet has orphaned tokens (Remy, sims) that the DB doesn't know about.

**Changes in `supabase/functions/trading-agent-force-sell/index.ts`:**

- Add a `sellAll: true` mode that uses `connection.getParsedTokenAccountsByOwner()` to discover ALL token accounts in the wallet
- Iterate through every non-zero token balance and sell via Jupiter market order
- For tokens that match a DB position, close the position normally
- For orphaned tokens (no DB match), just sell and log the result
- Cancel any outstanding Jupiter limit orders for the agent

---

### Part 3: Wipe Trade History and Reset Stats

After confirming all sells executed on-chain:

1. Delete all rows from `trading_agent_trades` for agent `1776eabc-5e58-46e2-be1d-5300dd202b51`
2. Delete all rows from `trading_agent_positions` for this agent
3. Reset agent stats: `total_trades=0, winning_trades=0, losing_trades=0, total_profit_sol=0, win_rate=0, best_trade_sol=0, worst_trade_sol=0`
4. Sync `trading_capital_sol` with actual on-chain SOL balance

---

### Part 4: Pause Cron Jobs

Disable the `trading-agent-execute` and `trading-agent-monitor` pg_cron entries temporarily so no new trades happen until you say "go".

---

### Part 5: Re-enable on Your Command

When you confirm the wallet is clean on Solscan:
- Re-enable cron jobs
- Max 2 concurrent positions enforced
- SL via DB polling (15-second checks), TP via Jupiter limit orders (now using correct API)
- Helius-verified PNL on every closed position
- Full buy/sell TX signatures recorded

---

### Execution Order

1. Fix Jupiter API endpoint in monitor (eliminates 404 spam)
2. Update force-sell to support `sellAll` mode
3. Deploy both functions
4. Call force-sell with `sellAll: true` to dump all 4 tokens
5. Verify sales on Solscan with you
6. Wipe DB history and reset stats
7. Pause cron jobs
8. Wait for your "go" to resume
