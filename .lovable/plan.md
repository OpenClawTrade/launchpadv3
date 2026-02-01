

# TUNA Agents - Complete Agent Token Launch Portal for Solana

## Overview

This plan creates a **complete Clawnch-like portal** called **TUNA Agents** on Solana. It includes a full-featured landing page, agent dashboard, API documentation (skill.md style), token listing, leaderboard, and a header menu button "TUNA Agents" integrated into the main navigation.

---

## What We're Building (Feature Parity with Clawnch)

| Clawnch Feature | TUNA Agents Equivalent |
|-----------------|------------------------|
| Landing page with stats header | `/agents` - Hero + stats bar |
| Token list with filters (New, Hot, MCap, Volume) | `/agents` - All agent tokens grid with tabs |
| Top tokens by market cap section | `/agents` - "Top by Market Cap" section |
| Agent docs at `/skill.md` | `/agents/docs` - Skill.md style documentation |
| Telegram alerts link | Telegram alerts integration |
| Platform token section | TUNA platform token card |
| "Agent-Only Token Launch" explainer | How-it-works section |
| Token cards with Trade/Post links | Token cards with Trade/Solscan links |
| Source platform badges (Moltx, 4claw, Moltbook) | Source badges (API, Twitter, Telegram) |
| 80% agent / 20% platform fee split | 80% agent / 20% platform fee split |
| Menu link in header | "TUNA Agents" button in header nav |

---

## Architecture

```text
Frontend Pages
├── /agents                    → Landing page (public)
│   ├── Stats bar (market cap, fees, tokens, volume)
│   ├── Hero section
│   ├── Platform token card
│   ├── "Agent-Only Token Launch" explainer
│   ├── Top by Market Cap section
│   └── All Tokens grid (New, Hot, MCap, Volume tabs)
│
├── /agents/docs               → Skill.md style documentation
│   ├── API endpoints
│   ├── Post formats (Twitter, Telegram)
│   ├── Code examples
│   └── Fee claiming instructions
│
├── /agents/dashboard          → Private agent dashboard
│   ├── API key management
│   ├── Tokens launched list
│   ├── Fees earned/claimed
│   └── Claim button
│
└── /agents/leaderboard        → Public agent rankings

Backend (Edge Functions)
├── agent-register             → Create agent account
├── agent-launch               → Launch token via API
├── agent-me                   → Get agent profile
├── agent-claim                → Claim accumulated fees
├── agent-tokens               → List all agent tokens (public)
└── agent-stats                → Aggregate stats for landing page

Database Tables
├── agents                     → Agent accounts
├── agent_tokens               → Tokens launched by agents
└── agent_fee_distributions    → Fee tracking and claims
```

---

## Phase 1: Database Schema

### Table: agents

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  total_tokens_launched INTEGER DEFAULT 0,
  total_fees_earned_sol NUMERIC DEFAULT 0,
  total_fees_claimed_sol NUMERIC DEFAULT 0,
  last_launch_at TIMESTAMPTZ,
  launches_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view agents" ON agents FOR SELECT USING (true);
```

### Table: agent_tokens

```sql
CREATE TABLE agent_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  fun_token_id UUID REFERENCES fun_tokens(id),
  source_platform TEXT DEFAULT 'api',
  source_post_id TEXT,
  source_post_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view agent tokens" ON agent_tokens FOR SELECT USING (true);
```

### Table: agent_fee_distributions

```sql
CREATE TABLE agent_fee_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  fun_token_id UUID REFERENCES fun_tokens(id),
  amount_sol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE agent_fee_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee distributions" ON agent_fee_distributions FOR SELECT USING (true);
```

### Modify: fun_tokens

Add columns for agent tracking:
- `agent_id UUID REFERENCES agents(id) NULL`
- `agent_fee_share_bps INTEGER DEFAULT 8000` (80%)

---

## Phase 2: Edge Functions

### 1. agent-register

Registers a new agent and returns an API key.

**Endpoint:** `POST /agent-register`

**Request:**
```json
{
  "name": "MyAgent",
  "walletAddress": "7xK9..."
}
```

**Response:**
```json
{
  "success": true,
  "agentId": "uuid",
  "apiKey": "tna_live_xxxx...",
  "apiKeyPrefix": "tna_live_",
  "dashboardUrl": "https://tuna.fun/agents/dashboard"
}
```

### 2. agent-launch

Launches a token and attributes it to the calling agent.

**Endpoint:** `POST /agent-launch`

**Headers:** `x-api-key: tna_live_xxx`

**Request:**
```json
{
  "name": "Cool Token",
  "symbol": "COOL",
  "description": "The coolest token",
  "image": "https://...",
  "website": "https://...",
  "twitter": "@cooltoken"
}
```

**Response:**
```json
{
  "success": true,
  "agent": "MyAgent",
  "tokenId": "uuid",
  "mintAddress": "TNA...",
  "poolAddress": "...",
  "tradeUrl": "https://tuna.fun/launchpad/TNA...",
  "solscanUrl": "https://solscan.io/token/TNA...",
  "rewards": {
    "agentShare": "80%",
    "platformShare": "20%",
    "agentWallet": "7xK9..."
  }
}
```

### 3. agent-me

Returns agent profile and stats.

**Endpoint:** `GET /agent-me`

**Headers:** `x-api-key: tna_live_xxx`

### 4. agent-claim

Claims accumulated fees to agent wallet.

**Endpoint:** `POST /agent-claim`

**Headers:** `x-api-key: tna_live_xxx`

### 5. agent-tokens

Public endpoint for landing page token list.

**Endpoint:** `GET /agent-tokens`

**Query params:** `?sort=new|hot|mcap|volume&limit=50`

### 6. agent-stats

Public endpoint for landing page stats.

**Endpoint:** `GET /agent-stats`

**Response:**
```json
{
  "totalMarketCap": 307990000,
  "totalAgentFeesEarned": 190400,
  "totalTokensLaunched": 439,
  "totalVolume": 19040000
}
```

---

## Phase 3: Frontend - Landing Page (/agents)

### File: src/pages/AgentsPage.tsx

**Layout Structure:**

```text
┌────────────────────────────────────────────────────────────┐
│ Header (same as main, with "TUNA Agents" active)           │
├────────────────────────────────────────────────────────────┤
│ Stats Bar                                                  │
│ $307.99M     $190.4K          439        $19.04M          │
│ MARKET CAP   AGENT FEES    TOKENS       VOLUME            │
├────────────────────────────────────────────────────────────┤
│                    🐟                                      │
│     Token Launches Exclusively for Agents                  │
│                                                            │
│   Free to launch via API or social platforms.              │
│   Agents earn 80% of trading fees.                         │
│                                                            │
│   [AGENT DOCS]  [TELEGRAM ALERTS]                          │
├────────────────────────────────────────────────────────────┤
│   $TUNA Platform Token                                     │
│   [DexScreener] [Trade] [Solscan]                          │
├────────────────────────────────────────────────────────────┤
│   Agent-Only Token Launch                                  │
│   1. Register as an agent via API                          │
│   2. Launch tokens with a single API call                  │
│   3. Agent collects 80% of all trading fees                │
│                                                            │
│   [Full Documentation →]                                   │
├────────────────────────────────────────────────────────────┤
│   Top by Market Cap                                        │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                 │
│   │ #1  │ │ #2  │ │ #3  │ │ #4  │ │ #5  │                 │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                 │
├────────────────────────────────────────────────────────────┤
│   All Tokens (439 total)                                   │
│   [New] [Hot] [MCap] [24h Vol]                             │
│                                                            │
│   ┌──────────────────────────────────────┐                 │
│   │ $COOL   API   +15.2%                 │                 │
│   │ Cool Token                           │                 │
│   │ by AgentName · 2h ago · $24.1K       │                 │
│   │ [Post] [Trade]                       │                 │
│   └──────────────────────────────────────┘                 │
│   ... more tokens ...                                      │
└────────────────────────────────────────────────────────────┘
```

### Components to Create

| Component | Purpose |
|-----------|---------|
| `AgentStatsBar.tsx` | Stats header (market cap, fees, tokens, volume) |
| `AgentHero.tsx` | Hero section with CTA buttons |
| `AgentPlatformToken.tsx` | Platform token card |
| `AgentHowItWorks.tsx` | 3-step explainer section |
| `AgentTopTokens.tsx` | Top 5 by market cap horizontal cards |
| `AgentTokenGrid.tsx` | Main token listing with filter tabs |
| `AgentTokenCard.tsx` | Individual token card |

---

## Phase 4: Frontend - Documentation (/agents/docs)

### File: src/pages/AgentDocsPage.tsx

A Clawnch `skill.md` style documentation page with:

1. **Quick Reference Header**
   - Name: TUNA Agents
   - Version: 1.0.0
   - Description: Launch memecoins on Solana. Agents earn 80% of trading fees.
   - Homepage: https://tuna.fun/agents

2. **API Registration**
   - POST /agent-register endpoint
   - Request/response examples
   - API key format (tna_live_xxx)

3. **Launch Token**
   - POST /agent-launch endpoint
   - Required/optional fields table
   - cURL examples
   - JavaScript/TypeScript examples

4. **Image Upload**
   - How to provide image URLs
   - Supported formats
   - IPFS/Arweave recommendations

5. **Revenue Split**
   - 80% to agent wallet
   - 20% to platform
   - Fee claiming instructions

6. **Rate Limits**
   - 1 launch per 24 hours per agent
   - 60 API requests per minute

7. **Social Platform Integration** (Future)
   - Twitter format with !tunalaunch
   - Telegram bot integration

---

## Phase 5: Frontend - Dashboard (/agents/dashboard)

### File: src/pages/AgentDashboardPage.tsx

Private area for registered agents:

**Sections:**
1. **Stats Overview**
   - Tokens launched
   - Total fees earned
   - Pending fees to claim
   - Claim button

2. **API Key Management**
   - Show API key prefix
   - Regenerate button
   - Copy functionality

3. **Tokens Launched**
   - Table with: Name, Symbol, Created, Volume, Fees Generated
   - Links to trade page

4. **Fee History**
   - List of claims with signatures

---

## Phase 6: Header Navigation Update

### Modify: src/pages/FunLauncherPage.tsx

Add "TUNA Agents" button to desktop nav:

```tsx
<Link to="/agents">
  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
    TUNA Agents
  </Button>
</Link>
```

Add to mobile menu:

```tsx
<Link to="/agents" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
  <span className="text-foreground text-sm font-medium">TUNA Agents</span>
</Link>
```

### Modify: src/components/layout/LaunchpadLayout.tsx

Same navigation updates for consistency.

### Modify: src/App.tsx

Add new routes:

```tsx
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AgentDocsPage = lazy(() => import("./pages/AgentDocsPage"));
const AgentDashboardPage = lazy(() => import("./pages/AgentDashboardPage"));
const AgentLeaderboardPage = lazy(() => import("./pages/AgentLeaderboardPage"));

// In Routes:
<Route path="/agents" element={<AgentsPage />} />
<Route path="/agents/docs" element={<AgentDocsPage />} />
<Route path="/agents/dashboard" element={<AgentDashboardPage />} />
<Route path="/agents/leaderboard" element={<AgentLeaderboardPage />} />
```

---

## Phase 7: Fee Distribution Logic

### Modify: fun-distribute Edge Function

When distributing fees for an agent-launched token:

```text
if token.agent_id exists:
    agent_share = fee_amount * 0.80  (80%)
    platform_share = fee_amount * 0.20  (20%)
    
    send agent_share to agent.wallet_address
    send platform_share to TUNA treasury
    
    update agents.total_fees_earned_sol
    insert into agent_fee_distributions
else:
    use normal 50/30/20 distribution
```

---

## Files to Create

### Pages
| File | Purpose |
|------|---------|
| `src/pages/AgentsPage.tsx` | Main landing page |
| `src/pages/AgentDocsPage.tsx` | Documentation (skill.md style) |
| `src/pages/AgentDashboardPage.tsx` | Private dashboard |
| `src/pages/AgentLeaderboardPage.tsx` | Public rankings |

### Components
| File | Purpose |
|------|---------|
| `src/components/agents/AgentStatsBar.tsx` | Stats header |
| `src/components/agents/AgentHero.tsx` | Hero section |
| `src/components/agents/AgentPlatformToken.tsx` | Platform token card |
| `src/components/agents/AgentHowItWorks.tsx` | How it works section |
| `src/components/agents/AgentTopTokens.tsx` | Top 5 by mcap |
| `src/components/agents/AgentTokenGrid.tsx` | Token list with tabs |
| `src/components/agents/AgentTokenCard.tsx` | Individual token card |
| `src/components/agents/AgentApiKeyCard.tsx` | API key display |
| `src/components/agents/AgentClaimButton.tsx` | Fee claim CTA |
| `src/components/agents/AgentDocsContent.tsx` | Documentation renderer |

### Hooks
| File | Purpose |
|------|---------|
| `src/hooks/useAgent.ts` | Agent auth and profile |
| `src/hooks/useAgentTokens.ts` | Fetch agent tokens |
| `src/hooks/useAgentStats.ts` | Fetch aggregate stats |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/agent-register/index.ts` | Registration |
| `supabase/functions/agent-launch/index.ts` | Token launch |
| `supabase/functions/agent-me/index.ts` | Profile endpoint |
| `supabase/functions/agent-claim/index.ts` | Fee claiming |
| `supabase/functions/agent-tokens/index.ts` | Public token list |
| `supabase/functions/agent-stats/index.ts` | Public stats |

---

## Implementation Order

1. **Database** - Create tables (agents, agent_tokens, agent_fee_distributions)
2. **Edge Functions** - agent-stats, agent-tokens (public data first)
3. **Landing Page** - /agents with all sections
4. **Header Update** - Add "TUNA Agents" to navigation
5. **Edge Functions** - agent-register, agent-launch, agent-me
6. **Dashboard** - /agents/dashboard
7. **Documentation** - /agents/docs
8. **Fee System** - Modify fun-distribute for 80/20 split
9. **Edge Functions** - agent-claim
10. **Leaderboard** - /agents/leaderboard

---

## Summary

This plan delivers a complete Clawnch-equivalent portal for TUNA on Solana including:

- Full landing page with stats, hero, token list, and filters
- skill.md style API documentation
- Agent dashboard for managing API keys and claiming fees
- 80/20 fee split (80% to agent, 20% to platform)
- Header navigation integration
- Rate limiting (1 launch per 24h per agent)
- Public leaderboard for agent rankings

