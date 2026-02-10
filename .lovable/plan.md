

# ✅ COMPLETED: Fix Take-Profit and Stop-Loss

## Changes Made

### 1. Fixed `checkJupiterOrderStatus` (monitor)
- Changed query from `?user=${orderPubkey}` to `?user=${walletAddress}` 
- Added `wallet_address` to the monitor's position query select
- TP detection now works correctly

### 2. Added On-Chain SL Order (execute)
- Now places BOTH TP and SL Jupiter Trigger orders after every buy
- SL uses same `createJupiterLimitOrder` with stop-loss price amounts
- Both pubkeys stored: `limit_order_tp_pubkey` + `limit_order_sl_pubkey`

### 3. Simplified Monitor (monitor)
- Replaced hybrid DB-polling with pure order status checks
- When TP fills → cancel SL, record profit, close position
- When SL fills → cancel TP, record loss, close position
- Fallback DB-based monitoring only for legacy positions without orders

### 4. Fixed Ghost Position Guard (execute)
- Single query catches ALL unclosed positions: `status IN ('open', 'sell_failed', 'stopped_out') AND closed_at IS NULL`
- Added `sell_failed` to position status check constraint

### 5. Recovery
- Updated 10 ghost `stopped_out` positions to `sell_failed`
- Force-sell requires admin secret — trigger manually

## Remaining: Force-Sell
Call the force-sell endpoint with your admin secret to liquidate stuck tokens:
```
POST /trading-agent-force-sell
Body: {"agentId": "1776eabc-5e58-46e2-be1d-5300dd202b51", "sellAll": true}
Header: x-admin-secret: <your TWITTER_BOT_ADMIN_SECRET>
```

