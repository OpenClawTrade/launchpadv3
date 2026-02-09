
# Fix: Stop-Loss Limit Orders Filling Immediately

## Root Cause

Jupiter Trigger/Limit Orders work as: "I will give X tokens (makingAmount) and want at least Y SOL (takingAmount)."

The order fills when the market can provide >= takingAmount for the makingAmount. This works perfectly for **Take Profit** (sell tokens when price goes UP), but is fundamentally broken for **Stop Loss**:

- Entry price = 0.0001 SOL/token
- Stop Loss at -20% = 0.00008 SOL/token
- The SL order says: "Sell all tokens, I want at least 80% of entry value"
- At entry time, the market gives 100% of entry value, which is MORE than 80%
- Jupiter fills the SL order **immediately** because the condition is already satisfied

This is why the "sell" happens 2 seconds after the buy -- it's the SL limit order being filled right away.

## Fix Strategy

**Stop-loss cannot be implemented as a Jupiter limit order.** Limit orders are "sell at or above" -- they can never trigger on price drops. The SL must use the existing DB-based price monitoring in the monitor function.

Only the **Take Profit** order should be placed as an on-chain limit order. The Stop Loss should be handled by the `trading-agent-monitor` polling loop (the fallback path that already exists).

## Changes

### 1. `supabase/functions/trading-agent-execute/index.ts`

Remove the SL limit order placement (lines ~405-416). Keep only the TP limit order. Update the position record to reflect:
- `limit_order_sl_pubkey` = null (no on-chain SL)
- `limit_order_sl_status` = 'none' (monitored via DB)
- `limit_order_tp_pubkey` = set as before
- `limit_order_tp_status` = 'active'

### 2. `supabase/functions/trading-agent-monitor/index.ts`

Update the monitoring logic so that positions with only a TP limit order still get DB-based SL checks:

- Currently, `hasLimitOrders` skips to the "limit order mode" path and bypasses DB-based SL/TP checks entirely (line 240-323).
- Change the logic: if a position has a TP limit order but no SL limit order, check the TP order status on-chain AND also do the DB-based stop-loss price check. If the SL triggers via price monitoring, cancel the TP limit order and execute a market sell.

### 3. Redeploy both edge functions

## Technical Details

```text
BEFORE (broken):
  Buy token --> Place SL limit order (fills immediately!) --> Place TP limit order
  Result: Token sold 2 seconds after purchase

AFTER (fixed):
  Buy token --> Place TP limit order only --> Monitor SL via price polling
  Result: TP fills on-chain when price rises, SL executes via market sell when price drops
```

### File: `trading-agent-execute/index.ts`
- Remove lines 405-416 (SL limit order creation)
- Keep lines 418-428 (TP limit order creation)
- Update position update to set SL fields to null/none

### File: `trading-agent-monitor/index.ts`
- Modify the `hasLimitOrders` block (lines 238-324):
  - Check TP limit order status as before
  - Add DB-based SL price check even when TP limit order exists
  - If SL triggers: cancel TP limit order on-chain, execute market sell, close position
