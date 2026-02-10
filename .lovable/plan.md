
# Full Database and System Separation for Claw Mode

## Why Full Separation?
To ensure Claw Mode operates as a completely independent project, every piece of data -- tokens, agents, trading agents, fees, claims, stats, posts, and deployer wallets -- must live in its own set of tables. This prevents any cross-contamination between the main TUNA platform and Claw Mode.

## Database Tables to Create

We need to create **mirror tables** prefixed with `claw_` for every data entity:

### 1. Core Token Tables
| New Table | Mirrors | Purpose |
|-----------|---------|---------|
| `claw_tokens` | `fun_tokens` | All tokens launched via Claw Mode |
| `claw_agent_tokens` | `agent_tokens` | Links between claw agents and their tokens |
| `claw_fee_claims` | `fun_fee_claims` | Fee claims for claw tokens |

### 2. Agent Tables
| New Table | Mirrors | Purpose |
|-----------|---------|---------|
| `claw_agents` | `agents` | Claw-specific agents (social identity, wallet, API key) |
| `claw_agent_fee_distributions` | `agent_fee_distributions` | Fee payouts to claw agents |

### 3. Trading Agent Tables
| New Table | Mirrors | Purpose |
|-----------|---------|---------|
| `claw_trading_agents` | `trading_agents` | Trading agents created via Claw |
| `claw_trading_positions` | `trading_agent_positions` | Open/closed positions |
| `claw_trading_trades` | `trading_agent_trades` | Individual trade history |
| `claw_trading_fee_deposits` | `trading_agent_fee_deposits` | Fee deposits into trading wallets |
| `claw_trading_strategy_reviews` | `trading_agent_strategy_reviews` | AI strategy reviews |

### 4. Social / Community Tables
| New Table | Mirrors | Purpose |
|-----------|---------|---------|
| `claw_communities` | `subtuna` | SubClaw communities |
| `claw_posts` | `subtuna_posts` | Posts in SubClaw communities |
| `claw_comments` | `subtuna_comments` | Comments on claw posts |
| `claw_votes` | `subtuna_votes` | Votes on claw posts |

### 5. Infrastructure Tables
| New Table | Mirrors | Purpose |
|-----------|---------|---------|
| `claw_deployer_wallets` | `deployer_wallets` | Separate deployer wallet pool for Claw tokens |

**Total: 15 new tables**

Each table will have the same column structure as its mirror, with appropriate foreign keys pointing to other `claw_*` tables instead of the original ones.

## New Edge Functions

### 1. `claw-tokens` (mirrors `agent-tokens`)
- Queries `claw_agent_tokens` joined with `claw_tokens` and `claw_agents`
- Same sort/filter logic (new, hot, mcap, volume)

### 2. `claw-stats` (mirrors `agent-stats`)
- Queries only `claw_*` tables for market cap, fees, token count, volume, posts
- Independent cache, independent numbers

### 3. `claw-trading-list` (mirrors `trading-agent-list`)
- Lists trading agents from `claw_trading_agents`
- Joins `claw_trading_positions` for open position counts

### 4. `claw-trading-create` (mirrors `trading-agent-create`)
- Creates trading agents in `claw_trading_agents` and `claw_agents`
- Launches tokens into `claw_tokens`
- Uses a **separate deployer wallet** from `claw_deployer_wallets`
- Creates SubClaw community in `claw_communities`

## New Frontend Hooks

### 1. `useClawTokens` (mirrors `useAgentTokens`)
- Calls `claw-tokens` edge function instead of `agent-tokens`
- Same interface, different data source

### 2. `useClawStats` (mirrors `useAgentStats`)
- Calls `claw-stats` edge function
- Returns fresh Claw-only stats

### 3. `useClawTradingAgents` (mirrors `useTradingAgents`)
- Calls `claw-trading-list` edge function
- Lists only Claw trading agents

### 4. `useClawTradingAgent` (single agent detail)
- Queries `claw_trading_agents` directly

### 5. `useClawTradingAgentLeaderboard`
- Queries `claw_trading_agents` sorted by profit

## Frontend Component Updates

### Update `ClawStatsBar.tsx`
- Switch from `useAgentStats` to `useClawStats`

### Update `ClawTokenGrid.tsx`
- Switch from `useAgentTokens` to `useClawTokens`

### Update `ClawTradingSection.tsx`
- Switch from `useTradingAgents` / `useTradingAgentLeaderboard` to `useClawTradingAgents` / `useClawTradingAgentLeaderboard`
- Create agent modal calls `claw-trading-create` instead of `trading-agent-create`

## Deployer Wallet Separation

The Claw Mode will use a completely separate deployer wallet address. The `claw-trading-create` function will:
1. Pull from `claw_deployer_wallets` table (not `deployer_wallets`)
2. This ensures Claw token deployments never touch main platform deployer funds

## Complete Isolation Summary

```text
MAIN PLATFORM                    CLAW MODE
--------------                   ----------
fun_tokens          -->          claw_tokens
agent_tokens        -->          claw_agent_tokens
agents              -->          claw_agents
fun_fee_claims      -->          claw_fee_claims
agent_fee_distribs  -->          claw_agent_fee_distributions
trading_agents      -->          claw_trading_agents
trading_positions   -->          claw_trading_positions
trading_trades      -->          claw_trading_trades
trading_fee_deps    -->          claw_trading_fee_deposits
trading_reviews     -->          claw_trading_strategy_reviews
subtuna             -->          claw_communities
subtuna_posts       -->          claw_posts
subtuna_comments    -->          claw_comments
subtuna_votes       -->          claw_votes
deployer_wallets    -->          claw_deployer_wallets
agent-tokens (fn)   -->          claw-tokens (fn)
agent-stats (fn)    -->          claw-stats (fn)
trading-agent-list  -->          claw-trading-list (fn)
trading-agent-create-->          claw-trading-create (fn)
useAgentTokens      -->          useClawTokens
useAgentStats       -->          useClawStats
useTradingAgents    -->          useClawTradingAgents
```

## What Does NOT Need Separation
- **Authentication / profiles** -- users are shared across both modes
- **UI components** (AgentTokenCard, TradingAgentCard, FearGreedGauge) -- reusable, just styled differently
- **Sol price** -- shared utility
- **Matrix background, theme CSS** -- Claw-only, already separate

## Implementation Order
1. Create all 15 database tables via migration
2. Create the 4 new edge functions (`claw-tokens`, `claw-stats`, `claw-trading-list`, `claw-trading-create`)
3. Create the 5 new frontend hooks
4. Update the 3 Claw components to use the new hooks
5. Everything starts fresh with zero data -- clean slate for Claw Mode
