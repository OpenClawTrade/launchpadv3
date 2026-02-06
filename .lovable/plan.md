
# Fix Trading Agent Fee Routing Being Skipped by Holder Rewards Mode

## Problem Summary

The EQM trading agent shows "Accumulating Fees 0%" despite having:
- **0.22 SOL in total fees claimed** (from `fun_fee_claims`)
- **11.7% bonding progress** with active trading volume

The fees were routed to the `holder_reward_pool` (0.11 SOL distributed) instead of the trading agent's wallet.

## Root Cause

In `supabase/functions/fun-distribute/index.ts`, the fee routing logic has a priority bug:

```text
Line 174: const isHolderRewards = token.fee_mode === 'holder_rewards';
Line 189: if (isHolderRewards) { 
            // Route to holder pool...
            continue;  ← SKIPS agent logic entirely!
          }
Line 228: if (isAgentToken) {  ← Never reached for holder_rewards tokens
```

The EQM token has BOTH:
- `fee_mode: 'holder_rewards'`
- `is_trading_agent_token: true`

The holder rewards check runs first and calls `continue`, causing the trading agent distribution logic (lines 356-420) to be completely bypassed.

## Solution

Modify the fee routing priority to check for **trading agent tokens FIRST**, before holder rewards mode. Trading agents need the fees routed to their trading wallets regardless of fee_mode setting.

### Code Change

**File:** `supabase/functions/fun-distribute/index.ts`

**Current Logic (lines 171-227):**
```typescript
const isAgentToken = !!token.agent_id;
const isHolderRewards = token.fee_mode === 'holder_rewards';

if (isHolderRewards) {
  // Routes to holder pool
  continue; // Skips everything else!
}

if (isAgentToken) {
  // Agent handling (including trading agent check)
}
```

**Fixed Logic:**
```typescript
const isAgentToken = !!token.agent_id;
const isTradingAgentToken = token.is_trading_agent_token === true;
const isHolderRewards = token.fee_mode === 'holder_rewards';

// TRADING AGENT TOKENS: Always route to trading wallet, regardless of fee_mode
if (isTradingAgentToken && isAgentToken) {
  // Fetch trading agent by token.trading_agent_id (direct link)
  // Route fees to trading wallet
  // Skip holder rewards logic
  const key = `trading-agent:${token.trading_agent_id}`;
  // ... group handling ...
  continue; // Don't fall through to other modes
}

if (isHolderRewards) {
  // Only for NON-trading-agent tokens
  // Routes to holder pool
  continue;
}

if (isAgentToken) {
  // Regular AI agent handling (not trading agents)
}
```

### Database Fix

The EQM token already has the correct linkage but fees were misrouted. After deploying the code fix, we need to manually trigger the trading agent to receive its accumulated fees. The simplest approach is to update the trading agent's capital directly based on what was already collected:

```sql
-- Calculate total fees that should have gone to trading agent
-- EQM claimed 0.22 SOL total, 80% should go to agent = 0.176 SOL
-- But ~0.11 SOL already went to holder pool (lost)
-- Going forward, new fees will route correctly

-- No data fix needed - just deploy code fix and future fees route correctly
```

### Additional Improvement

Update the trading agent query in the distribution loop to use `trading_agent_id` directly (more reliable than going through `agent_id`):

```typescript
// Line 356-361: Change from
const { data: tradingAgent } = await supabase
  .from("trading_agents")
  .select("id, wallet_address, trading_capital_sol, status")
  .eq("agent_id", group.agentId)  // ← Uses agents table link
  .maybeSingle();

// To (for trading agent tokens):
const { data: tradingAgent } = await supabase
  .from("trading_agents")
  .select("id, wallet_address, trading_capital_sol, status")
  .eq("id", token.trading_agent_id)  // ← Direct trading_agent_id link
  .maybeSingle();
```

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/fun-distribute/index.ts` | Add trading agent token priority check before holder_rewards |

## Expected Outcome

After implementation:
1. New EQM swap fees will route to the trading agent's wallet (`FuxMJ...6P`)
2. `trading_capital_sol` will accumulate properly
3. Funding progress bar will show real percentages
4. Agent will auto-activate at 0.5 SOL threshold
5. Other trading agent tokens with holder_rewards mode will also work correctly

## Technical Notes

- The EQM token has ~0.11 SOL in holder_reward_pool that was already distributed - this cannot be recovered
- Future fees (new swaps) will route correctly after the fix
- The fix is backward compatible - regular holder_rewards tokens (without trading agents) continue working as before
