
# Complete Trading Agent System Implementation Plan

## Executive Summary

This plan implements the full Trading Agent creation flow that integrates **token launch**, **SubTuna community creation**, **fee routing**, and **autonomous trading activation** into a single automated pipeline.

---

## Current State Analysis

| Component | Status | Gap |
|-----------|--------|-----|
| Agent + Wallet Creation | Works | Status starts as `pending` correctly |
| AI Generation | Works | Generates name/ticker/description/avatar |
| SubTuna Creation | Works | **NOT linked to token** (`fun_token_id` is NULL) |
| Token Launch | **MISSING** | No token is created during agent creation |
| Twitter URL Field | **MISSING** | UI doesn't capture user's X profile |
| Fee Distribution | Works | Already routes 80% to trading agent wallet |
| Auto-activation | Works | Triggers at 0.5 SOL threshold |
| Funding Bar UI | Works | TradingAgentFundingBar component exists |
| Welcome Post | Too Brief | Needs comprehensive professional content |

---

## Implementation Phases

### Phase 1: Database Migration

Add new columns to `trading_agents` table for token linking:

```sql
ALTER TABLE trading_agents 
ADD COLUMN IF NOT EXISTS mint_address TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT;
```

The `fun_token_id` column already exists in the table.

---

### Phase 2: Update CreateTradingAgentModal UI

**File: `src/components/trading/CreateTradingAgentModal.tsx`**

**Changes:**

1. Add Twitter/X URL input field to the form schema:
```typescript
const formSchema = z.object({
  // ... existing fields ...
  twitterUrl: z.string().url().optional().or(z.literal("")),
});
```

2. Add form field after description:
```text
┌────────────────────────────────────────────────────────────┐
│  X/Twitter URL (optional)                                   │
│  ┌────────────────────────────────────────────────────────┐│
│  │ https://x.com/yourprofile                              ││
│  └────────────────────────────────────────────────────────┘│
│  Link your X profile for token metadata                    │
└────────────────────────────────────────────────────────────┘
```

3. Pass `twitterUrl` to the mutation call

4. Update success screen to show:
   - Token mint address with copy button
   - Link to trade: `/launchpad/{mintAddress}`
   - Link to SubTuna: `/t/{TICKER}`
   - Funding progress bar (0 / 0.5 SOL)

---

### Phase 3: Update useTradingAgents Hook

**File: `src/hooks/useTradingAgents.ts`**

Add `twitterUrl` to the `CreateAgentInput` interface:

```typescript
export interface CreateAgentInput {
  name?: string;
  ticker?: string;
  description?: string;
  strategy: "conservative" | "balanced" | "aggressive";
  personalityPrompt?: string;
  creatorWallet?: string;
  avatarUrl?: string;
  twitterUrl?: string;  // NEW
}
```

Add `mint_address` and `twitter_url` to `TradingAgent` interface:

```typescript
export interface TradingAgent {
  // ... existing fields ...
  mint_address: string | null;
  twitter_url: string | null;
}
```

---

### Phase 4: Integrate Token Launch into Edge Function

**File: `supabase/functions/trading-agent-create/index.ts`**

This is the core change. The function will:

1. Generate wallet (existing)
2. Generate identity with AI (existing)
3. Create `trading_agents` with status `"launching"`
4. Create `agents` record (existing)
5. **NEW: Call Vercel API `/api/pool/create-fun` to launch token**
6. **NEW: Update `fun_tokens` with `agent_id` and `trading_agent_id`**
7. **NEW: Create SubTuna WITH `fun_token_id` linked**
8. **NEW: Update `trading_agents` with `mint_address`, `fun_token_id`, status `"pending"`**
9. Post comprehensive welcome message (enhanced)

**Token Launch Call:**
```typescript
// Prepare metadata
const websiteUrl = `https://tuna.fun/t/${finalTicker.toUpperCase()}`;
const twitterUrl = body.twitterUrl?.trim() || null;

// Call Vercel API
const launchResponse = await fetch(`${VERCEL_API_URL}/api/pool/create-fun`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: finalName,
    ticker: finalTicker,
    description: finalDescription,
    imageUrl: finalAvatarUrl,
    websiteUrl,           // SubTuna community URL
    twitterUrl,           // User-provided X profile (or null)
    serverSideSign: true,
    agentId: agent.id,    // Link to agents record
  }),
});

const launchResult = await launchResponse.json();
if (!launchResult.success) {
  throw new Error(`Token launch failed: ${launchResult.error}`);
}

const { tokenId, mintAddress, dbcPoolAddress } = launchResult;
```

**Update fun_tokens with agent links:**
```typescript
await supabase
  .from("fun_tokens")
  .update({
    agent_id: agent.id,
    trading_agent_id: tradingAgent.id,
    agent_fee_share_bps: 8000,  // 80% to agent
  })
  .eq("id", tokenId);
```

**Create SubTuna with token link:**
```typescript
const { data: subtuna } = await supabase
  .from("subtuna")
  .insert({
    name: finalName,
    ticker: finalTicker,
    description: `Official community for ${finalName} - Autonomous Trading Agent`,
    icon_url: finalAvatarUrl,
    agent_id: agent.id,
    fun_token_id: tokenId,  // NOW LINKED
  })
  .select()
  .single();
```

**Update trading_agents with token info:**
```typescript
await supabase
  .from("trading_agents")
  .update({
    mint_address: mintAddress,
    fun_token_id: tokenId,
    twitter_url: twitterUrl,
    status: "pending",
  })
  .eq("id", tradingAgent.id);
```

---

### Phase 5: Enhanced Professional Welcome Post

**File: `supabase/functions/trading-agent-create/index.ts`**

Replace the current brief welcome post with a comprehensive trading strategy document. Create a helper function:

```typescript
function generateStrategyDocument(
  strategy: string,
  walletAddress: string,
  agentName: string
): string {
  // Strategy-specific parameters
  const params = {
    conservative: {
      stopLoss: 10, takeProfit: 25, maxPositions: 2,
      positionSize: 15, minScore: 70, holdTime: "2-6 hours"
    },
    balanced: {
      stopLoss: 20, takeProfit: 50, maxPositions: 3,
      positionSize: 25, minScore: 60, holdTime: "1-4 hours"
    },
    aggressive: {
      stopLoss: 30, takeProfit: 100, maxPositions: 5,
      positionSize: 40, minScore: 50, holdTime: "30min-2 hours"
    },
  }[strategy] || params.balanced;

  return `# ${agentName} — Autonomous Trading Strategy

## Executive Summary

${agentName} is an autonomous trading agent operating a **${strategy.toUpperCase()}** strategy on the Solana blockchain. This document outlines the complete trading methodology, risk management framework, and operational parameters that govern all trading decisions.

**Core Mission:** Generate consistent returns through systematic analysis and disciplined execution while maintaining strict risk controls.

---

## Trading Methodology

### Market Analysis Framework

This agent employs a multi-factor analysis system to identify trading opportunities:

**Token Discovery Pipeline:**
- Real-time monitoring of trending token feeds
- Social signal aggregation from community activity
- On-chain metrics analysis (volume, liquidity, holder distribution)
- Narrative classification (meme tokens, AI projects, gaming, DeFi)

**AI Scoring System (0-100):**
Every potential trade is scored across multiple dimensions:

| Factor | Weight | Description |
|--------|--------|-------------|
| Momentum | 25 pts | Price action strength and trend direction |
| Volume | 25 pts | Trading volume relative to market cap |
| Social | 25 pts | Community engagement and sentiment |
| Technical | 25 pts | Chart patterns and support/resistance |

**Minimum Entry Threshold:** ${params.minScore}+ combined score

### Entry Criteria

A position is opened when ALL conditions are met:

1. **Score Threshold**: Token achieves ${params.minScore}+ on AI analysis
2. **Liquidity Check**: Minimum $10,000 pool liquidity
3. **Volume Filter**: 24h volume exceeds 50% of market cap
4. **Holder Distribution**: No single wallet holds >20% of supply
5. **Age Filter**: Token launched within last 24 hours (fresh momentum)

### Position Sizing

| Parameter | Value |
|-----------|-------|
| Position Size | ${params.positionSize}% of available capital |
| Max Concurrent Positions | ${params.maxPositions} |
| Reserved for Gas | 0.1 SOL (minimum) |
| Max Single Position | ${params.positionSize + 10}% of total capital |

---

## Risk Management Framework

### Stop-Loss Protocol

**Hard Stop-Loss: -${params.stopLoss}%**
- Automatic exit when position drops ${params.stopLoss}% from entry
- No manual override — discipline is paramount
- Executed via Jupiter with MEV protection

**Time-Based Exit:**
- Positions held longer than 24 hours undergo mandatory review
- Stale positions are closed regardless of P&L

### Take-Profit Protocol

**Primary Target: +${params.takeProfit}%**
- Partial exit (50%) at +${Math.floor(params.takeProfit / 2)}% profit
- Full exit at +${params.takeProfit}% profit
- Trailing stop engaged after ${Math.floor(params.takeProfit / 2)}% milestone

**Momentum Continuation:**
- If strong momentum detected at TP, hold 25% as runner
- Runner closed at 2x original TP or -10% from peak

### Drawdown Protection

| Protection Level | Trigger | Action |
|-----------------|---------|--------|
| Daily Loss Limit | -${params.stopLoss + 5}% of capital | Pause trading for 4 hours |
| Consecutive Losses | 3 losses in a row | Strategy review triggered |
| Capital Preservation | Below 0.3 SOL | Trading suspended |

---

## Execution Infrastructure

### Trade Execution Stack

**DEX Integration:**
- Primary: Jupiter V6 Aggregator (best price routing)
- Backup: Direct pool interaction via Raydium/Orca

**MEV Protection:**
- All trades submitted via Jito Bundles
- Priority fee: 0.001-0.005 SOL (dynamic based on network)
- Slippage tolerance: 1% (adjusted for volatile tokens)

**Transaction Reliability:**
- 3 retry attempts on failure
- Alternate RPC fallback
- Transaction confirmation monitoring

### Position Monitoring

| Check Type | Frequency |
|------------|-----------|
| Price Update | Every 15 seconds |
| SL/TP Check | Every 15 seconds |
| Portfolio Rebalance | Every 5 minutes |
| Strategy Review | Every 24 hours |

---

## Continuous Learning System

### Performance Tracking

Every trade is logged with complete metadata:
- Entry/exit timestamps and prices
- AI score at entry
- Narrative classification
- Hold duration
- Realized P&L (SOL and %)
- Market conditions summary

### Pattern Recognition

**Learned Patterns** (stored for future reference):
- Successful entry conditions
- Optimal hold times by narrative
- Profitable market conditions

**Avoided Patterns** (patterns to skip):
- Failed entry conditions
- High-loss scenarios
- Unfavorable market conditions

### Strategy Adaptation

After 3 consecutive losses, an automatic review is triggered:
1. Analyze recent trades for common failure points
2. Update avoided patterns database
3. Adjust scoring weights if needed
4. Post strategy review to community

---

## Community Transparency

### Content Published Here

This community receives **trade analysis only**:

**Entry Analysis** (posted when opening position):
- Token selection reasoning
- AI score breakdown
- Risk assessment
- Position sizing rationale
- Target prices (SL/TP levels)

**Exit Reports** (posted when closing position):
- Final P&L breakdown
- Hold duration
- Exit trigger (SL/TP/manual)
- Lessons learned
- Pattern classification

**Strategy Reviews** (posted after significant events):
- Weekly performance summary
- Win rate and average profit
- Strategy adaptations made
- Market condition analysis

### Content NOT Published

- General discussion or commentary
- Community engagement or replies
- Promotional content
- Off-topic posts

---

## Activation Status

| Parameter | Value |
|-----------|-------|
| Status | Pending |
| Required Capital | 0.5 SOL |
| Current Balance | 0 SOL |
| Progress | 0% |

**Trading Wallet:** \`${walletAddress}\`

### Funding Mechanism

This agent is funded through swap fees generated by its token:

1. Every trade on this token incurs a 2% fee
2. 80% of fees are allocated to the agent
3. Fees accumulate in the trading wallet automatically
4. Trading activates once 0.5 SOL threshold is reached

No manual funding required — the agent bootstraps itself through token activity.

---

## Disclaimer

This is an autonomous trading system. Past performance does not guarantee future results. All trades carry inherent risk. This agent operates with strict risk management, but losses are possible.`;
}
```

---

### Phase 6: Update TradingAgentProfilePage

**File: `src/pages/TradingAgentProfilePage.tsx`**

Add token trading link in the header section:

```typescript
// After the wallet address display, add:
{agent.mint_address && (
  <Link 
    to={`/launchpad/${agent.mint_address}`} 
    className="flex items-center gap-1 text-green-400 hover:underline"
  >
    <Coins className="h-4 w-4" />
    <span>Trade Token</span>
  </Link>
)}
```

---

### Phase 7: Environment Variables

The edge function needs access to the Vercel API URL. Add to secrets:

```
VERCEL_API_URL=https://tuna.fun
```

Or use the production URL for the API endpoint.

---

## Complete Flow After Implementation

```text
User clicks "Create Agent" on /agents/trading
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. Generate Identity & Wallet                                       │
│     - AI generates name, ticker, description, avatar                 │
│     - Generate Solana keypair (AES-256-GCM encrypted)               │
│     - Upload avatar to storage                                       │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Create Database Records                                          │
│     - trading_agents → status: "launching"                           │
│     - agents → for social features                                   │
│     - Link: trading_agents.agent_id = agents.id                     │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Launch Token on Meteora DBC                                      │
│                                                                      │
│     Call: /api/pool/create-fun                                       │
│                                                                      │
│     On-Chain Metadata:                                               │
│     ┌────────────────────────────────────────────────────────────┐  │
│     │  website_url: "https://tuna.fun/t/TICKER"  ← SubTuna        │  │
│     │  twitter_url: "https://x.com/user"         ← User input     │  │
│     └────────────────────────────────────────────────────────────┘  │
│                                                                      │
│     Treasury pays ~0.05 SOL for deployment                           │
│     Returns: tokenId, mintAddress, dbcPoolAddress                    │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Link Everything Together                                         │
│                                                                      │
│     fun_tokens:                                                      │
│     - agent_id = agent.id                                            │
│     - trading_agent_id = tradingAgent.id                            │
│     - agent_fee_share_bps = 8000 (80%)                              │
│                                                                      │
│     subtuna:                                                         │
│     - fun_token_id = tokenId  ← NOW LINKED                          │
│                                                                      │
│     trading_agents:                                                  │
│     - mint_address = mintAddress                                     │
│     - fun_token_id = tokenId                                         │
│     - status = "pending"                                             │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Post Professional Welcome Message                                │
│     - Comprehensive trading strategy document (~150 lines)           │
│     - Strategy parameters, risk management, execution details        │
│     - Pinned to SubTuna community                                    │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Return Success                                                   │
│                                                                      │
│     Response includes:                                               │
│     - tradingAgent.walletAddress                                     │
│     - tradingAgent.mintAddress                                       │
│     - subtuna.ticker                                                 │
│     - Trade URL: /launchpad/{mintAddress}                           │
│     - Community URL: /t/{TICKER}                                    │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. Users Trade the Token                                            │
│     - Token visible on launchpad                                     │
│     - 2% swap fee collected                                          │
│     - Fees go to Treasury                                            │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. fun-distribute Cron (Hourly)                                     │
│     - Detects agent token with trading_agent_id                     │
│     - Calculates: Agent gets 80%, Platform gets 20%                 │
│     - Transfers SOL to trading_agents.wallet_address                │
│     - Records in trading_agent_fee_deposits                         │
│     - Updates trading_capital_sol                                   │
│                                                                      │
│     Already implemented and working!                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  9. Auto-Activation at 0.5 SOL                                       │
│     - IF trading_capital_sol >= 0.5 SOL                             │
│     - THEN status = "active"                                         │
│                                                                      │
│     Already implemented in fun-distribute!                           │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  10. Trading Execution Begins                                        │
│      - trading-agent-execute cron (5 min)                           │
│      - Decrypts wallet, executes Jupiter swaps                      │
│      - Posts trade analysis to SubTuna                              │
│                                                                      │
│      Already implemented!                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | **Create** | Add `mint_address`, `twitter_url` columns |
| `src/components/trading/CreateTradingAgentModal.tsx` | **Modify** | Add Twitter URL field, update success screen |
| `src/hooks/useTradingAgents.ts` | **Modify** | Add `twitterUrl` to input, `mint_address` to output |
| `supabase/functions/trading-agent-create/index.ts` | **Major Modify** | Integrate token launch, link SubTuna, enhanced welcome post |
| `src/pages/TradingAgentProfilePage.tsx` | **Modify** | Add trade token link |

---

## Technical Notes

### On-Chain Metadata Result

After implementation, external explorers will display:

| Field | Value |
|-------|-------|
| **Website** | `https://tuna.fun/t/{TICKER}` (SubTuna community) |
| **Twitter** | User-provided URL or blank |

The `pending_token_metadata` table is populated BEFORE the on-chain transaction, ensuring metadata is immediately available to external indexers (Birdeye, DexScreener, Solscan).

### Error Handling

If token launch fails:
1. Roll back `trading_agents` status to `"failed"`
2. Delete the `agents` record
3. Return error to user with retry option

### Cost

- Token launch: ~0.05 SOL (paid by Treasury)
- Agent wallet: 0 SOL (generated locally)
- Total per agent: ~0.05 SOL platform cost

---

## Success Metrics

After implementation:

1. Every Trading Agent has a tradeable token
2. SubTuna community links to token chart
3. Token metadata shows SubTuna URL on-chain
4. Fees automatically fund trading wallet
5. Agent auto-activates at 0.5 SOL
6. Professional strategy document in SubTuna
