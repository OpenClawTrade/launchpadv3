
# Complete Trading Agent System Implementation

## Current State Analysis

Based on my code exploration, here's what EXISTS vs what's MISSING:

| Component | Status | Notes |
|-----------|--------|-------|
| Trading Agent CRUD | ✅ Exists | Create, read, list agents working |
| Agent Profile Page | ✅ Exists | `/agents/trading/:id` fully implemented |
| Cron Jobs | ✅ Exists | `trading-agent-execute` (5min) + `trading-agent-monitor` (1min) already scheduled |
| Fee Deposits Table | ✅ Exists | `trading_agent_fee_deposits` table exists but **EMPTY** |
| Fee Routing | ❌ MISSING | `fun-distribute` routes to agents table, NOT trading_agent wallets |
| Status Field | ⚠️ Partial | Agents have `status` but no `pending` → `active` auto-activation |
| Funding Progress UI | ❌ MISSING | No visual progress bar for 0.5 SOL threshold |
| High-Frequency Polling | ❌ MISSING | Monitor runs once per minute, not 15-second internal loops |
| pumpfun-trending-sync | ⚠️ Unknown | Need to verify cron exists |

## Implementation Plan

### Phase 1: Fix Fee Routing to Trading Agent Wallets

**File: `supabase/functions/fun-distribute/index.ts`**

Currently, `fun-distribute` routes 80% of agent token fees to `agent_fee_distributions` table. But Trading Agents need fees routed to their **trading wallets** for autonomous trading.

**Changes Required:**
1. Detect if an agent is a Trading Agent (has entry in `trading_agents` table)
2. If Trading Agent: transfer SOL directly to `trading_agents.wallet_address` on-chain
3. Record deposit in `trading_agent_fee_deposits` table
4. Update `trading_agents.trading_capital_sol` balance
5. Auto-activate agent when balance reaches 0.5 SOL

```
// Pseudocode for fun-distribute enhancement:
if (isAgentToken && group.agentId) {
  // Check if this agent has a trading agent profile
  const { data: tradingAgent } = await supabase
    .from("trading_agents")
    .select("id, wallet_address, trading_capital_sol, status")
    .eq("agent_id", group.agentId)
    .single();

  if (tradingAgent) {
    // This is a Trading Agent - send SOL directly to trading wallet
    const transferTx = await sendSolToTradingWallet(
      treasuryKeypair,
      tradingAgent.wallet_address,
      recipientAmount
    );
    
    // Record in trading_agent_fee_deposits
    await supabase.from("trading_agent_fee_deposits").insert({
      trading_agent_id: tradingAgent.id,
      amount_sol: recipientAmount,
      source: "fee_distribution",
      signature: transferTx,
    });
    
    // Update trading capital
    const newCapital = tradingAgent.trading_capital_sol + recipientAmount;
    await supabase.from("trading_agents").update({
      trading_capital_sol: newCapital,
      last_deposit_at: new Date().toISOString(),
      // Auto-activate when threshold reached
      status: newCapital >= 0.5 ? "active" : "pending",
    }).eq("id", tradingAgent.id);
    
    continue; // Skip normal agent distribution
  }
  
  // Regular agent - existing logic
}
```

### Phase 2: Create Funding Progress Bar Component

**New File: `src/components/trading/TradingAgentFundingBar.tsx`**

A visual progress bar showing:
- Current balance vs 0.5 SOL threshold
- "Accumulating Fees" / "Ready to Trade" status
- Percentage complete
- Animated progress fill

```
// TradingAgentFundingBar.tsx
interface FundingBarProps {
  currentBalance: number;
  threshold?: number; // default 0.5 SOL
  status: "pending" | "active" | "paused";
}

// Visual states:
// - pending + < threshold: Yellow bar, "Accumulating Fees (X/0.5 SOL)"
// - pending + >= threshold: Green bar, "Activating..."
// - active: Green checkmark, "Trading Active"
// - paused: Gray bar, "Paused"
```

### Phase 3: Update TradingAgentCard with Funding Status

**File: `src/components/trading/TradingAgentCard.tsx`**

Add the funding progress bar for agents in "pending" status:

```
// Inside TradingAgentCard, after the Capital section:
{agent.status === "pending" && (
  <TradingAgentFundingBar 
    currentBalance={agent.trading_capital_sol || 0}
    status={agent.status}
  />
)}

{agent.status === "active" && (
  <div className="flex items-center gap-1 text-xs text-green-400">
    <CheckCircle className="h-3 w-3" />
    Trading Active
  </div>
)}
```

### Phase 4: Update TradingAgentProfilePage with Funding Section

**File: `src/pages/TradingAgentProfilePage.tsx`**

Add a prominent funding status section at the top of the profile:

```
// After the stats cards, before tabs:
{agent.status === "pending" && (
  <Card className="bg-amber-500/5 border-amber-500/30 mb-8">
    <CardContent className="p-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-full bg-amber-500/20">
          <Wallet className="h-8 w-8 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">Agent Funding Progress</h3>
          <TradingAgentFundingBar 
            currentBalance={agent.trading_capital_sol || 0}
            status={agent.status}
          />
          <p className="text-sm text-muted-foreground mt-2">
            This agent will start trading autonomously once fees from token swaps 
            accumulate to 0.5 SOL in its trading wallet.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

### Phase 5: High-Frequency Polling in Monitor Function

**File: `supabase/functions/trading-agent-monitor/index.ts`**

Add internal 15-second polling loop to maximize the 60-second Edge Function runtime:

```
// At the start of the handler:
const startTime = Date.now();
const MAX_RUNTIME_MS = 50000; // 50 seconds, leave 10s buffer
const POLL_INTERVAL_MS = 15000; // 15 seconds

let totalChecks = 0;
let totalTrades = 0;

while (Date.now() - startTime < MAX_RUNTIME_MS) {
  console.log(`[trading-agent-monitor] Check #${++totalChecks}...`);
  
  // Existing monitoring logic here...
  // ...fetch positions, check SL/TP, execute sells...
  
  // Wait before next check (skip if near timeout)
  if (Date.now() - startTime + POLL_INTERVAL_MS < MAX_RUNTIME_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  } else {
    break;
  }
}

console.log(`[trading-agent-monitor] Completed ${totalChecks} checks in ${Date.now() - startTime}ms`);
```

### Phase 6: Add pumpfun-trending-sync Cron Job

**Action:** Create cron job if it doesn't exist

```sql
SELECT cron.schedule(
  'pumpfun-trending-sync-every-3-min',
  '*/3 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ptwytypavumcrbofspno.supabase.co/functions/v1/pumpfun-trending-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:='{"trigger": "cron"}'::jsonb
  );
  $$
);
```

### Phase 7: Extend TradingAgent Type with Funding Fields

**File: `src/hooks/useTradingAgents.ts`**

Add new fields to the interface:

```typescript
export interface TradingAgent {
  // ... existing fields ...
  
  // Funding status fields
  last_deposit_at: string | null;
  funding_progress: number; // Calculated: trading_capital_sol / 0.5 * 100
  is_funded: boolean; // trading_capital_sol >= 0.5
}
```

**File: `supabase/functions/trading-agent-list/index.ts`**

Calculate funding progress in the response:

```typescript
const enrichedAgents = agents?.map(agent => ({
  ...agent,
  openPositions: posCountMap.get(agent.id) || 0,
  roi: ...,
  // Add funding info
  funding_progress: Math.min(100, ((agent.trading_capital_sol || 0) / 0.5) * 100),
  is_funded: (agent.trading_capital_sol || 0) >= 0.5,
}));
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/fun-distribute/index.ts` | **Modify** | Add Trading Agent wallet routing + auto-activation |
| `src/components/trading/TradingAgentFundingBar.tsx` | **Create** | Visual funding progress component |
| `src/components/trading/TradingAgentCard.tsx` | **Modify** | Add funding status bar |
| `src/components/trading/index.ts` | **Modify** | Export new component |
| `src/pages/TradingAgentProfilePage.tsx` | **Modify** | Add funding section |
| `supabase/functions/trading-agent-monitor/index.ts` | **Modify** | Add 15-second internal polling loop |
| `supabase/functions/trading-agent-list/index.ts` | **Modify** | Add funding_progress field |
| `src/hooks/useTradingAgents.ts` | **Modify** | Add funding fields to interface |

## Database Changes

No schema changes needed - `trading_agent_fee_deposits` table already exists with correct structure.

## Visual Design: Funding Progress Bar

```text
┌──────────────────────────────────────────────────────────────────────┐
│  ⚡ Funding Progress                                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  │                    32%                                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  0.16 / 0.5 SOL • Trading starts when funded                        │
└──────────────────────────────────────────────────────────────────────┘

// Active state:
┌──────────────────────────────────────────────────────────────────────┐
│  ✅ Trading Active                                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │████████████████████████████████████████████████████████████████│  │
│  │                    100%                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  0.85 SOL capital • 3 open positions                                │
└──────────────────────────────────────────────────────────────────────┘
```

## Expected Behavior After Implementation

1. **User creates Trading Agent** → Status: `pending`, Balance: 0 SOL
2. **Users trade agent's token** → Fees accumulate in treasury
3. **fun-distribute cron runs** → Detects Trading Agent, sends SOL to trading wallet
4. **trading_agent_fee_deposits** → Record created for each deposit
5. **trading_agents.trading_capital_sol** → Balance increases
6. **UI shows progress bar** → Users see "0.32 / 0.5 SOL (64%)"
7. **Balance reaches 0.5 SOL** → Status auto-updates to `active`
8. **trading-agent-execute cron** → Starts executing trades
9. **UI shows "Trading Active"** → Green checkmark, open positions count

## Cost Impact

- **Zero additional cost** - Uses existing infrastructure
- Jito tips (0.001-0.01 SOL per trade) paid from trading wallet
- SOL transfer gas (~0.000005 SOL per deposit) paid from treasury
