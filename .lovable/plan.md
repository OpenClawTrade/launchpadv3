

# Fix: Prevent Ghost Positions and Add Sell Validation

## Problem Identified

The agent has critical bugs causing real losses:

1. **GLUTE sold for 0.000000417 SOL** (cost 0.64 SOL) -- nearly total loss
2. **PSX sold for 0.000000459 SOL** (cost 0.66 SOL) -- nearly total loss
3. Tokens are likely **still in the wallet** because the swap returned dust (wrong amount sent to Jupiter)
4. The DB marks these as "stopped_out" so the max-2 check passes, allowing new buys while unsold tokens sit in the wallet

**Root Cause**: The `amountToSell` calculation in the monitor has a flawed heuristic:
```
if (amount_tokens > 1,000,000) use raw value
else multiply by 10^decimals
```
This can send the wrong amount to Jupiter depending on how `amount_tokens` was stored (raw vs human-readable), resulting in dust swaps.

## Changes

### 1. Fix the sell amount calculation (trading-agent-monitor)
- Remove the fragile 1M threshold heuristic for token decimals
- Always use consistent logic: if `amount_tokens` is stored as human-readable, multiply by decimals; if stored as raw lamports, use directly
- Cross-reference with how the buy stores `amount_tokens` to ensure consistency

### 2. Add minimum sell validation (trading-agent-monitor)
- After a swap, check if `solReceived` is less than a minimum threshold (e.g., 1% of investment)
- If the sell returned dust, log it as a **failed sell** rather than recording a successful closure
- Keep the position open so it can be retried or force-sold

### 3. Add wallet token balance check before buying (trading-agent-execute)
- Before allowing new buys, check the actual on-chain SOL balance of the agent wallet
- Compare against DB-tracked `trading_capital_sol` to detect discrepancies from ghost positions
- If the wallet has significantly less SOL than expected, skip buying and log a warning

### 4. Force-sell stuck tokens (trading-agent-force-sell)
- Use this existing function to clean up GLUTE and PSX tokens still in the wallet
- The force-sell already has escalating slippage (15%, 25%, 50%) for illiquid tokens

## Technical Details

### File: `supabase/functions/trading-agent-monitor/index.ts`
- Lines 306-311: Replace the `amountToSell` heuristic with consistent decimal handling
- Lines 319-331: Add validation that `solReceived` is meaningful (above 1% of investment) before recording closure
- If sell returned dust, mark position with a new status like `sell_failed` instead of closing it

### File: `supabase/functions/trading-agent-execute/index.ts`
- Around line 308-321: After checking DB open positions count, also sync with on-chain balance
- Add a guard: if `positions marked stopped_out in last hour have sell amount < 0.001 SOL`, count them as effectively still open

### Immediate Action
- After deploying fixes, trigger force-sell on GLUTE and PSX tokens still in wallet to recover remaining value

