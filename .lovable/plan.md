

# Trading Agent 67: Critical Bugs Analysis & Fix Plan

## Summary

The trading agent has **4 critical bugs** causing incorrect behavior and potential financial loss:

| Issue | Severity | Impact |
|-------|----------|--------|
| **Duplicate position entries** | CRITICAL | Bought same token twice (0.5 SOL on "the" token) |
| **Capital tracking mismatch** | HIGH | DB shows 1.83 SOL but wallet only has 1.07 SOL |
| **Dead code in monitor** | HIGH | Old deprecated V6 API code still exists alongside new V1 |
| **Position de-dupe bug** | CRITICAL | `existingTokens` filter not working correctly |

---

## Bug 1: Duplicate Positions on Same Token

**Evidence:**
```
Token "the" (4YxQxZL...): 2 open positions
  - Position 1: 0.25 SOL @ 05:16:06
  - Position 2: 0.25 SOL @ 05:16:11 (5 seconds later!)
  
Total invested in "the": 0.50 SOL (should be max 0.25)
```

**Root Cause:**
The `existingTokens` filter at line 240-242 checks positions BEFORE the trade executes. When multiple cron jobs fire in rapid succession (or if the execute function runs twice), the race condition allows buying the same token twice because the first position hasn't been committed yet.

**Fix:**
```typescript
// Add database lock or check for recent trades on same token
const lastTrade = await supabase
  .from("trading_agent_trades")
  .select("created_at")
  .eq("trading_agent_id", agent.id)
  .eq("token_address", selectedToken.mint_address)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

// Skip if traded this token within last 5 minutes
if (lastTrade?.data && Date.now() - new Date(lastTrade.data.created_at).getTime() < 300000) {
  console.log(`[trading-agent-execute] Already traded ${selectedToken.symbol} recently, skipping`);
  continue;
}
```

---

## Bug 2: Capital Tracking Mismatch

**Evidence:**
- Database `trading_capital_sol`: 1.833 SOL
- On-chain balance: **1.074 SOL**
- Discrepancy: **0.76 SOL**

**Calculation:**
```
4 positions x 0.25 SOL = 1.00 SOL invested
Started with ~2.08 SOL
After 1.00 SOL invested: ~1.08 SOL remaining

But DB shows 1.83 SOL available + 0.25 SOL invested = 2.08 SOL total
DB thinks only 1 trade executed, but 4 positions exist!
```

**Root Cause:**
- `total_invested_sol` shows 0.25 (only 1 trade logged)
- `total_trades` shows 1 (but 4 positions exist)
- The execute function updates capital **per trade** at line 372-380, but the duplicate positions weren't properly tracked

**Fix:**
```typescript
// Before executing any trade, sync capital with on-chain balance
const actualBalance = await connection.getBalance(agentKeypair.publicKey) / 1e9;
const dbCapital = agent.trading_capital_sol || 0;

if (Math.abs(actualBalance - dbCapital) > 0.1) {
  console.warn(`[trading-agent-execute] Balance mismatch: DB=${dbCapital}, Chain=${actualBalance}`);
  // Sync DB to on-chain reality
  await supabase.from("trading_agents").update({
    trading_capital_sol: actualBalance
  }).eq("id", agent.id);
}
```

---

## Bug 3: Dead V6 Code in Monitor Function

**Evidence:**
Lines 510-583 in `trading-agent-monitor/index.ts` contain the old `executeJupiterSwap()` function that uses deprecated V6 endpoints:

```typescript
// Line 520 - OLD DEPRECATED CODE STILL EXISTS:
const quoteUrl = `https://quote-api.jup.ag/v6/quote?...`; 
const swapResponse = await fetch("https://quote-api.jup.ag/v6/swap", ...);
```

While the new `executeJupiterSwapWithJito()` function (starting line 693) uses V1, the old function is still in the codebase and could cause confusion or be accidentally called.

**Fix:**
Remove the entire deprecated `executeJupiterSwap()` function (lines 510-583) since `executeJupiterSwapWithJito()` is the correct implementation.

---

## Bug 4: Sells Cannot Execute - Token Decimals Issue

**Evidence from monitor logs:**
```
Monitoring 4 open positions
0 trades in 47223ms (no sells happening despite positions existing)
```

**Potential Issue:**
The monitor calculates token amount to sell:
```typescript
const tokenDecimals = await getTokenDecimals(connection, position.token_address);
const amountToSell = Math.floor(position.amount_tokens * Math.pow(10, tokenDecimals));
```

If `position.amount_tokens` is already in base units (1.6B tokens = 1.6B raw), multiplying by 10^6 again would produce an astronomically large number that fails validation.

**Fix:**
Check if the stored `amount_tokens` is already in base units vs decimal form and handle appropriately.

---

## Implementation Steps

### Step 1: Emergency Capital Sync

Run a one-time sync to fix the balance discrepancy:
```sql
UPDATE trading_agents 
SET trading_capital_sol = 1.074, -- actual on-chain balance
    total_invested_sol = 1.00,   -- 4 positions x 0.25
    total_trades = 4             -- actual trade count
WHERE id = '1776eabc-5e58-46e2-be1d-5300dd202b51';
```

### Step 2: Fix Execute Function

Add race condition protection:
1. Check for recent trades on same token (last 5 min)
2. Sync on-chain balance before trading
3. Add position count verification

### Step 3: Clean Up Monitor Function

1. Remove deprecated `executeJupiterSwap()` function
2. Verify token decimal handling in sells
3. Add logging for sell quote/swap attempts

### Step 4: Add Safeguards

1. Database constraint: unique (trading_agent_id, token_address) WHERE status = 'open'
2. Pre-trade balance verification
3. Post-trade balance reconciliation

---

## Technical Summary

| File | Changes |
|------|---------|
| `trading-agent-execute/index.ts` | Add race condition protection, balance sync |
| `trading-agent-monitor/index.ts` | Remove dead V6 code, fix token decimal handling |
| Database | One-time capital sync, add unique constraint |

