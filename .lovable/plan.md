

# Close All Positions and Record Trade History

## Current State

The agent has 3 open positions, all without limit orders (legacy):

| Position | Token | Entry Investment | Tokens |
|----------|-------|-----------------|--------|
| `f0bed053` | "the" (4YxQx...) | 0.25 SOL | 1,657,317,205 |
| `81fb9892` | "The" (8TVr3...) | 0.25 SOL | 53,100 |
| `7ba25b44` | "first" (9XR4t...) | 0.25 SOL | 1,342,259 |

There is also 1 already-closed duplicate position. Only 2 BUY trade records exist -- no SELL records at all.

## Plan

### 1. Get current token prices from Jupiter

Before closing, we need the current market price for each token to calculate real P&L. We will query Jupiter's price API for the 3 token mints to get the current SOL value of each position.

### 2. Close all 3 open positions (database update)

For each position, calculate:
- `current_value_sol` = current_price * amount_tokens
- `realized_pnl_sol` = current_value - investment (0.25 SOL each)
- `realized_pnl_pct` = ((current_value - investment) / investment) * 100

Then update each position:
```sql
UPDATE trading_agent_positions SET
  status = 'closed',
  current_price_sol = <jupiter_price>,
  current_value_sol = <calculated>,
  realized_pnl_sol = <calculated>,
  unrealized_pnl_sol = 0,
  unrealized_pnl_pct = 0,
  exit_reason = 'manual_close',
  closed_at = NOW()
WHERE id IN ('f0bed053-...', '81fb9892-...', '7ba25b44-...');
```

### 3. Create SELL trade records for each position

Insert a corresponding SELL trade for each closed position so the trade history tab shows complete buy/sell pairs:

```sql
INSERT INTO trading_agent_trades (
  trading_agent_id, position_id, token_address, token_name,
  trade_type, amount_sol, amount_tokens, price_per_token,
  strategy_used, ai_reasoning, confidence_score, status
) VALUES (
  '<agent_id>', '<position_id>', '<token_address>', '<token_name>',
  'sell', <exit_value_sol>, <amount_tokens>, <exit_price>,
  'balanced', 'Position closed - legacy cleanup. No on-chain limit orders were set.',
  100, 'success'
);
```

### 4. Add missing BUY trade records

Positions `81fb9892` ("The") and `7ba25b44` ("first") have no corresponding buy trade records. We need to insert those too so the history is complete.

### 5. Update agent aggregate stats

```sql
UPDATE trading_agents SET
  total_trades = <new_total>,
  winning_trades = <count where pnl > 0>,
  losing_trades = <count where pnl <= 0>,
  total_profit_sol = <sum of all realized pnl>,
  win_rate = <wins / total * 100>,
  best_trade_sol = <highest pnl>,
  worst_trade_sol = <lowest pnl>,
  total_invested_sol = <sum of all investments>
WHERE id = '1776eabc-5e58-46e2-be1d-5300dd202b51';
```

### 6. Enhance Trade History UI

Update `TradingAgentProfilePage.tsx` to show sell-specific fields:
- Show "Profit/Loss" column for sell trades with green/red coloring
- Display exit reason badge
- Show the buy-sell pair linkage via `position_id`

## Execution Steps

1. Query Jupiter price API for 3 token mints to get current prices
2. Calculate P&L for each position
3. Execute DB updates: close positions, insert sell trades, insert missing buy trades, update agent stats
4. Update the trade history UI to display sell trades with P&L info

## Files to Modify

| File | Change |
|------|--------|
| Database (data operations) | Close 3 positions, insert 3 sell + 2 buy trade records, update agent stats |
| `src/pages/TradingAgentProfilePage.tsx` | Enhance trade history to show P&L on sell trades and exit reasons |

