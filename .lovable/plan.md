

# Fix: Both Take-Profit and Stop-Loss Are Broken

## Root Causes Found

### Take-Profit: Never Detected as Filled
The `checkJupiterOrderStatus` function (monitor line 1051) has a critical bug:
```
getTriggerOrders?user=${orderPubkey}&orderStatus=active
```
It passes the **order pubkey** as `user`. Jupiter's API expects the **wallet address** as `user`. This means the query always returns empty results, so the status is always `'unknown'`. TP fills are never detected, and positions stay open forever even after Jupiter executes them.

### Stop-Loss: Can Also Be On-Chain
My previous advice that "Jupiter can't do stop-losses" was **wrong**. Jupiter Trigger orders use keeper bots that monitor on-chain prices and execute when the target price is reached. Unlike traditional limit order books, a trigger order saying "sell 1000 TOKEN for X SOL" only executes when the keeper detects the price has reached that rate. This works for both take-profit AND stop-loss scenarios.

This means we can place BOTH TP and SL as on-chain Jupiter Trigger orders, eliminating the unreliable DB polling entirely.

## Plan (3 Changes)

### 1. Fix `checkJupiterOrderStatus` (trading-agent-monitor)
**Lines 1047-1095**: Change the `getTriggerOrders` query to use the agent's wallet address instead of the order pubkey. Then search the returned orders list for the matching order pubkey.

```
// BEFORE (broken):
getTriggerOrders?user=${orderPubkey}

// AFTER (fixed):
getTriggerOrders?user=${walletAddress}
// Then find the specific order by pubkey in the results
```

This requires passing the agent's wallet address into the function. The function signature changes from `checkJupiterOrderStatus(orderPubkey, apiKey)` to `checkJupiterOrderStatus(orderPubkey, walletAddress, apiKey)`.

### 2. Place Stop-Loss as On-Chain Trigger Order (trading-agent-execute)
**Lines 640-682**: After the buy, place TWO Jupiter Trigger orders:
- **TP order** (existing): sell all tokens, `takingAmount` = SOL at take-profit price
- **SL order** (new): sell all tokens, `takingAmount` = SOL at stop-loss price

Both use the same `createJupiterLimitOrder` function. The stop-loss order will have a lower `takingAmount` (less SOL received), and Jupiter's keeper will execute it when the price drops to that level.

Store the SL order pubkey in `limit_order_sl_pubkey` and set `limit_order_sl_status = 'active'`.

### 3. Simplify Monitor to Check Both Order Statuses (trading-agent-monitor)
**Lines 238-386**: Remove the entire DB-based price polling and manual swap execution for stop-losses. Replace with:
1. Check TP order status via `getTriggerOrders` (with fixed wallet address query)
2. Check SL order status via `getTriggerOrders`
3. If TP filled: cancel SL order, record profit, close position
4. If SL filled: cancel TP order, record loss, close position
5. Still update `current_price_sol` for display purposes

This removes: wallet decryption for sells, on-chain balance queries, `executeJupiterSwapWithJito`, dust validation, Token-2022 lookups during monitoring. All of that complexity goes away because Jupiter handles the actual execution.

### 4. Immediate Recovery
- Force-sell all 16 stuck tokens using `trading-agent-force-sell`
- Update ghost positions in the database to `sell_failed` so the guard blocks new buys until cleanup is done

## Technical Details

### File: `supabase/functions/trading-agent-execute/index.ts`
- Lines 640-682: After placing TP order, add SL order placement using the same `createJupiterLimitOrder` function with stop-loss price
- Calculate SL amounts: `slSolLamports = Math.floor(stopLossPrice * tokensReceived * 1e9)`
- Store `limit_order_sl_pubkey` and set status to `'active'`

### File: `supabase/functions/trading-agent-monitor/index.ts`
- Lines 1047-1095: Fix `checkJupiterOrderStatus` to accept and use wallet address as `user` param
- Lines 238-386: Replace hybrid TP/SL monitoring with pure order status checking
- Keep price update logic (lines 220-236) for display
- When one order fills, cancel the other via `cancelJupiterLimitOrder`
- Keep manual sell as a fallback only if both orders fail to place at buy time

### Why This Works
Jupiter Trigger orders are NOT traditional limit orders. They use keeper bots that:
1. Monitor token prices via Jupiter Price API
2. Execute only when the market price reaches the trigger price
3. Tap into liquidity across 20+ DEXs
4. Work for both "sell above entry" (TP) and "sell below entry" (SL)

The keeper runs 24/7 regardless of whether our Edge Function is running. This is fundamentally more reliable than 5-second polling in a 55-second Edge Function window.

