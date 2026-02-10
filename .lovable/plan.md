
# Fix Trading Agent: Failed Orders and Position Limit Bypass

## Root Cause Analysis

There are **3 critical bugs** causing failed orders and holding more than 2 tokens:

### Bug 1: No On-Chain Position Count Guard (Most Critical)
The execute function at line 308-322 ONLY checks the database for open positions. It does NOT scan the on-chain wallet for actual token holdings. If the DB is out of sync (ghost positions, unclosed positions, or race conditions between concurrent execute calls), the agent bypasses the 2-position limit and buys more tokens.

### Bug 2: Orphaned Limit Orders Not Cancelled on Zero-Balance Close
When the monitor detects a position was sold via zero-balance check (lines 270-310), it updates the DB status of the TP/SL orders but **never actually cancels them on-chain**. It calls `supabase.update({ limit_order_tp_status: 'cancelled' })` but never calls `cancelJupiterLimitOrder()`. These orphaned orders stay active on Jupiter and can execute later, causing unexpected sells and failed transactions.

### Bug 3: TP/SL Order Placement Failure Silently Ignored
When limit order placement fails (line 665-667), the position is already created and the swap already executed. The agent holds tokens with NO stop-loss or take-profit protection. The code just logs a warning and moves on.

## Changes

### 1. `supabase/functions/trading-agent-execute/index.ts` - Add On-Chain Position Guard

**Before the DB position count check (line 308)**, add an on-chain wallet scan:

- Decrypt the agent wallet
- Use `getParsedTokenAccountsByOwner` for both SPL Token and Token-2022 programs
- Count all token accounts with non-zero balances
- If on-chain token count >= maxPositions (2), BLOCK the trade regardless of what the DB says
- Log a warning if DB count and on-chain count disagree (desync detection)

This is the **dual-layer guard** described in the memory but never actually implemented in the execute function.

### 2. `supabase/functions/trading-agent-monitor/index.ts` - Cancel Orphaned Orders On-Chain

In the zero-balance detection block (lines 270-310), after detecting the position was sold:

- Decrypt the agent wallet (already available from balance check)
- If `hasTPOrder` and the order should be cancelled, call `cancelJupiterLimitOrder()` (the actual on-chain cancellation function that already exists at line 1225)
- Same for `hasSLOrder`
- Only then update the DB status

This ensures orphaned Jupiter trigger orders are actually removed from the chain, preventing failed transactions.

### 3. `supabase/functions/trading-agent-execute/index.ts` - Cancel ALL Existing Orders Before New Buy

Before executing a new buy swap, cancel any leftover Jupiter trigger orders from previous positions:

- Query `getTriggerOrders` for the agent wallet
- If any active orders exist, cancel them all before proceeding
- This prevents order conflicts and cleans up any ghost orders

### 4. `supabase/functions/trading-agent-execute/index.ts` - Rollback Position on TP/SL Failure

If BOTH TP and SL order placements fail (lines 630-668):

- Immediately sell the tokens back (reverse the swap)
- Delete the position record from the DB
- Log a critical error
- This prevents holding unprotected positions

## Technical Details

### On-Chain Guard Implementation (Execute Function)
```text
// Before line 308, after decrypting wallet:
1. getParsedTokenAccountsByOwner(agentPubkey, { programId: TOKEN_PROGRAM })
2. getParsedTokenAccountsByOwner(agentPubkey, { programId: TOKEN_2022_PROGRAM })
3. Count accounts where tokenAmount.uiAmount > 0
4. If count >= maxPositions -> BLOCK, log "On-chain guard: X tokens held"
```

### Orphaned Order Cancellation (Monitor Function)
```text
// Inside zero-balance detection (after line 270):
1. Decrypt wallet (already done for balance check)
2. If hasTPOrder && closeReason === "stop_loss":
   cancelJupiterLimitOrder(connection, agentKeypair, jupiterApiKey, position.limit_order_tp_pubkey)
3. If hasSLOrder && closeReason === "take_profit":
   cancelJupiterLimitOrder(connection, agentKeypair, jupiterApiKey, position.limit_order_sl_pubkey)
```

### Pre-Buy Order Cleanup (Execute Function)
```text
// Before the Jupiter swap (line 575):
1. Fetch getTriggerOrders?user=walletAddress&orderStatus=active
2. For each active order -> cancelJupiterLimitOrder()
3. This ensures a clean slate before entering new positions
```

These changes together create a bulletproof system:
- On-chain guard prevents >2 positions regardless of DB state
- Orphaned order cleanup prevents failed txs from lingering Jupiter orders
- Pre-buy cleanup prevents order conflicts
- TP/SL failure rollback prevents unprotected positions
