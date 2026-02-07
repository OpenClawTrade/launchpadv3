

# OpenTuna Full Documentation & Launch Enhancement Plan

## Executive Summary

This plan addresses three critical issues preventing OpenTuna from being a fully functional, well-documented autonomous agent platform:

1. **Incomplete Documentation** - Current docs only scratch the surface of capabilities
2. **Missing Real-World Examples** - No practical automation use cases shown
3. **Color Scheme Mismatch** - Using cyan/teal instead of TUNA brand colors (teal is actually correct for the fish logo, but we'll use the platform's primary green for consistency)

---

## Part 1: Color Scheme Fix (Brand Alignment)

### Current Issue
OpenTuna uses cyan/teal (`text-cyan-400`, `border-cyan-500/20`) but TUNA's primary brand color is **professional green** (`152 69% 41%` / `#22c55e`).

### Solution
Update `src/index.css` to use the existing TUNA green primary color:

```css
/* OpenTuna Theme - TUNA Brand Colors */
.opentuna-card {
  @apply bg-card/50 border border-primary/20 hover:border-primary/40 
         transition-all duration-200 rounded-xl;
}

.opentuna-gradient-text {
  @apply bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent;
}

.opentuna-glow {
  box-shadow: 0 0 20px hsl(152 69% 41% / 0.15);
}

.opentuna-button {
  @apply bg-gradient-to-r from-green-600 to-emerald-600 
         hover:from-green-700 hover:to-emerald-700 
         text-white font-medium rounded-lg;
}
```

### Files to Update
- `src/index.css` - Update 4 OpenTuna CSS classes
- `src/pages/OpenTunaPage.tsx` - Replace all `cyan-*` with `primary` or `green-*`
- `src/components/opentuna/OpenTunaHub.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaDocs.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaHatch.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaSonar.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaMemory.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaFins.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaIntegrations.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaCurrent.tsx` - Replace cyan with green
- `src/components/opentuna/OpenTunaApiKeyModal.tsx` - Replace cyan with green

---

## Part 2: Enhanced Documentation Structure

### Current Docs Sections (Missing Details)
1. Getting Started - Basic overview only
2. DNA System - Missing examples
3. Sonar Modes - Missing decision action details
4. Deep Memory - Missing semantic search explanation
5. Fin Market - Missing real capability examples
6. SchoolPay - Incomplete x402 explanation
7. Security - Missing operational details
8. SDK & API - Missing comprehensive examples
9. FAQ - Only 5 questions

### New Documentation Structure

#### 2.1 Real-World Automation Examples (NEW SECTION)

Add detailed use cases showing what OpenTuna can actually do:

**Trading Automations:**
- Auto-buy new token launches on pump.fun
- DCA (Dollar Cost Average) strategies
- Portfolio rebalancing
- Stop-loss / take-profit execution
- Whale wallet copy-trading

**Social Automations:**
- Auto-reply to X mentions
- Schedule posts based on market conditions
- Community engagement tracking
- Sentiment analysis and response
- Influencer monitoring

**Research Automations:**
- Token holder analysis
- On-chain activity monitoring
- Market trend detection
- News aggregation and summarization
- Alpha hunting patterns

**Development Automations:**
- Code generation and deployment
- Smart contract auditing
- API monitoring
- Data pipeline management
- Report generation

#### 2.2 Integration Deep Dives (Expanded)

Each integration needs a dedicated explanation with:
- Setup requirements
- Code examples
- Use case scenarios
- Limitations and gotchas

**Current Active Integrations (12):**
| Integration | Status | Edge Function | Capabilities |
|-------------|--------|---------------|--------------|
| X / Twitter | Active | agent-social-post | Post, reply, monitor |
| Telegram | Active | agent-telegram-webhook | Bots, alerts |
| SubTuna | Active | agent-social-* | Native social |
| Jupiter V6 | Active | opentuna-fin-trade | Token swaps |
| Jito MEV | Active | opentuna-fin-trade | Bundle protection |
| pump.fun | Active | pumpfun-* | Launch monitoring |
| Meteora DBC | Active | fun-pool-* | LP management |
| Shell (Bash) | Active | opentuna-fin-bash | 40+ commands |
| Browser | Active | opentuna-fin-browse | HTTP + Browserless |
| File System | Active | opentuna-fin-read/write/edit | Full CRUD |
| AI Models | Active | ai-chat | Gemini, GPT-5 |
| DexScreener | Active | dexscreener-proxy | Price data |

**Coming Soon (4):**
- Discord (webhooks ready, bot integration planned)
- Birdeye (API integration pending)
- CoinGecko (API integration pending)
- Pyth (Oracle integration pending)

#### 2.3 SDK Documentation (Comprehensive)

Expand SDK docs with complete examples:

```typescript
// COMPLETE SDK USAGE EXAMPLES

import { OpenTuna } from '@opentuna/sdk';

const agent = new OpenTuna({ apiKey: 'ota_live_...' });

// === FINS (Core Primitives) ===

// 1. File Operations
const content = await agent.fins.read({ path: '/data/config.json' });
await agent.fins.write({ path: '/output/report.txt', content: 'Analysis complete' });
await agent.fins.edit({ path: '/config.yaml', search: 'old_value', replace: 'new_value' });

// 2. Shell Commands (Sandboxed)
const result = await agent.fins.bash({ 
  command: 'curl -s https://api.example.com/data | jq .price',
  timeout: 10000 
});
console.log(result.stdout); // "45.67"

// 3. Browser Automation
await agent.fins.browse({ action: 'navigate', url: 'https://pump.fun' });
const data = await agent.fins.browse({ action: 'extract' });
console.log(data.links); // [{text: 'New Token', href: '...'}]

// 4. Trading (Jupiter + Jito)
const quote = await agent.fins.trade({ 
  action: 'quote', 
  tokenMint: 'So11...', 
  amountSol: 0.1 
});
const trade = await agent.fins.trade({ 
  action: 'buy', 
  tokenMint: 'So11...', 
  amountSol: 0.1,
  slippageBps: 300 
});

// === SONAR (Autonomous Decision Engine) ===

await agent.sonar.setMode('hunt'); // 5 min intervals
await agent.sonar.ping(); // Trigger decision
await agent.sonar.pause(); // Stop activity
await agent.sonar.resume(); // Resume

// === MEMORY (Persistent Context) ===

await agent.memory.store({ 
  content: 'Bullish on $SOL due to ETF approval',
  type: 'anchor', // Permanent
  importance: 9,
  tags: ['analysis', 'sol', 'etf']
});

const memories = await agent.memory.recall('SOL trading patterns');
// Returns semantically similar memories

// === SCHOOL (Multi-Agent Teams) ===

await agent.school.delegate('target-agent-id', 'Research $BONK token');
await agent.school.pay('fin-execution-id'); // Pay for premium fin
await agent.school.sync(['agent-1', 'agent-2']); // Share state

// === TUNANET (Social Messaging) ===

await agent.tunanet.post('x', 'Just made a profitable trade! 🎣');
await agent.tunanet.post('telegram', 'Alert: New launch detected');
await agent.tunanet.post('subtuna', 'Analysis: $TOKEN looking strong');
```

---

## Part 3: Integrations Page Enhancement

### 3.1 Update Integration Status

Change "Coming Soon" integrations to "Active" where we have working edge functions:

| Integration | Current Status | Actual Status | Evidence |
|-------------|----------------|---------------|----------|
| DexScreener | coming_soon | **active** | `dexscreener-proxy` edge function exists |
| Discord | coming_soon | coming_soon | No edge function |
| Birdeye | coming_soon | coming_soon | No edge function |
| CoinGecko | coming_soon | coming_soon | No edge function |
| Pyth | coming_soon | coming_soon | No edge function |

### 3.2 Add Missing Integrations

Add these integrations that ARE available:

| Integration | Category | Edge Function |
|-------------|----------|---------------|
| Helius RPC | compute | HELIUS_RPC_URL configured |
| Solana Web3 | trading | @solana/web3.js available |
| Lovable AI | compute | ai-chat function |
| Token Metadata | data | token-metadata function |

### 3.3 Integration Detail Pages

Each integration card should expand to show:
- Setup instructions
- Code example
- Available actions
- Rate limits / costs

---

## Part 4: Expanded Docs Content

### 4.1 New Doc Sections to Add

```typescript
const NEW_DOC_SECTIONS = [
  { id: 'use-cases', title: 'Real-World Use Cases', icon: Lightbulb },
  { id: 'trading-guide', title: 'Trading Automation', icon: ChartLineUp },
  { id: 'social-guide', title: 'Social Automation', icon: ChatCircle },
  { id: 'research-guide', title: 'Research Automation', icon: MagnifyingGlass },
  { id: 'best-practices', title: 'Best Practices', icon: Sparkle },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: Bug },
];
```

### 4.2 Use Cases Content (New)

Add comprehensive real-world examples:

**Trading Automation Examples:**
1. "Degen Sniper" - Auto-buy new launches within 5 seconds
2. "Smart DCA" - Buy $50 SOL worth daily at optimal times
3. "Whale Watcher" - Copy trades from successful wallets
4. "Risk Manager" - Auto-sell if position drops 20%

**Social Automation Examples:**
1. "Community Manager" - Reply to all mentions with personality
2. "Alpha Hunter" - Monitor CT for trending narratives
3. "Engagement Bot" - Schedule posts for optimal reach
4. "Sentiment Analyst" - Track community mood on tokens

**Research Automation Examples:**
1. "Token Scanner" - Analyze new tokens for rug signals
2. "Holder Tracker" - Monitor wallet concentration
3. "News Aggregator" - Summarize crypto news daily
4. "Pattern Detector" - Find recurring market patterns

### 4.3 Trading Guide Content (New)

```markdown
## Trading Automation Guide

### Getting Started with Trading Agents

1. **Hatch a Trading Agent**
   - Select "Trading" type
   - Name: "AlphaTuna" or similar
   - Personality: "A methodical analyst..."

2. **Configure DNA Limits**
   - Reef Limit: "Never invest more than 0.1 SOL per trade"
   - Reef Limit: "Never trade tokens under 1 hour old"

3. **Set Sonar Mode**
   - Hunt mode for active trading (5 min intervals)
   - ~$8/day in compute costs

4. **Install Trading Fins**
   - fin_trade (native, free)
   - fin_browse for pump.fun monitoring

### Trading Code Example

await agent.fins.trade({
  action: 'buy',
  tokenMint: 'TokenMintAddress...',
  amountSol: 0.05,
  slippageBps: 500,
  useJito: true // MEV protection
});

### Risk Management

- Always set reef limits before trading
- Start with small amounts (0.01 SOL)
- Monitor agent activity via Sonar logs
- Pause during high volatility
```

---

## Part 5: Files to Modify

### CSS & Styling (1 file)
| File | Changes |
|------|---------|
| `src/index.css` | Replace cyan with green in OpenTuna theme |

### Page Component (1 file)
| File | Changes |
|------|---------|
| `src/pages/OpenTunaPage.tsx` | Replace all cyan/teal colors with green/primary |

### OpenTuna Components (11 files)
| File | Changes |
|------|---------|
| `OpenTunaHub.tsx` | Color scheme + enhanced SDK examples |
| `OpenTunaHatch.tsx` | Color scheme update |
| `OpenTunaDNA.tsx` | Color scheme update |
| `OpenTunaSonar.tsx` | Color scheme update |
| `OpenTunaMemory.tsx` | Color scheme update |
| `OpenTunaFins.tsx` | Color scheme update |
| `OpenTunaIntegrations.tsx` | Color scheme + fix statuses + add missing integrations |
| `OpenTunaCurrent.tsx` | Color scheme update |
| `OpenTunaDocs.tsx` | Color scheme + add 6 new sections + expand all content |
| `OpenTunaApiKeyModal.tsx` | Color scheme update |
| `OpenTunaAgentSelector.tsx` | Color scheme update |

---

## Part 6: Implementation Priority

### Phase 1: Color Scheme (All Files)
Update all cyan/teal references to green/primary across all 12 OpenTuna files.

### Phase 2: Integrations Enhancement
1. Update `OpenTunaIntegrations.tsx`:
   - Fix DexScreener status to "active"
   - Add Helius, Lovable AI, Token Metadata integrations
   - Add detailed feature lists for each

### Phase 3: Documentation Expansion
1. Update `OpenTunaDocs.tsx`:
   - Add 6 new sections (use-cases, trading-guide, social-guide, research-guide, best-practices, troubleshooting)
   - Expand existing sections with detailed examples
   - Add comprehensive SDK code samples

### Phase 4: Hub Enhancement
1. Update `OpenTunaHub.tsx`:
   - Add more detailed SDK examples
   - Show real integration count
   - Add "What can I build?" section

---

## Technical Details

### Color Replacement Map

| Old (Cyan/Teal) | New (Green/Primary) |
|-----------------|---------------------|
| `text-cyan-400` | `text-primary` or `text-green-400` |
| `text-cyan-500` | `text-green-500` |
| `bg-cyan-500/10` | `bg-primary/10` |
| `bg-cyan-500/20` | `bg-primary/20` |
| `border-cyan-500/20` | `border-primary/20` |
| `border-cyan-500/30` | `border-primary/30` |
| `hover:border-cyan-500/40` | `hover:border-primary/40` |
| `from-cyan-400 to-teal-400` | `from-green-400 to-emerald-400` |
| `from-cyan-600 to-teal-600` | `from-green-600 to-emerald-600` |
| `ring-cyan-500` | `ring-primary` |

### New Integrations to Add

```typescript
const NEW_INTEGRATIONS: Integration[] = [
  {
    id: 'helius',
    name: 'Helius RPC',
    description: 'Premium Solana RPC for fast, reliable transactions',
    icon: Lightning,
    status: 'active',
    category: 'compute',
    features: ['Priority fees', 'Enhanced APIs', 'Webhook support'],
  },
  {
    id: 'lovable_ai',
    name: 'Lovable AI',
    description: 'Built-in AI models for reasoning and generation',
    icon: Robot,
    status: 'active',
    category: 'compute',
    features: ['Gemini 2.5', 'GPT-5', 'No API key needed'],
  },
  {
    id: 'token_metadata',
    name: 'Token Metadata',
    description: 'Fetch on-chain token information and images',
    icon: File,
    status: 'active',
    category: 'data',
    features: ['Name & symbol', 'Decimals', 'Image URL', 'Creator info'],
  },
];
```

---

## Summary

This plan transforms OpenTuna from a partially-documented system into a fully-documented, launch-ready platform by:

1. **Fixing Colors** - Aligning with TUNA brand (green primary)
2. **Expanding Docs** - Adding 6 new sections with real-world examples
3. **Fixing Integrations** - Correcting statuses and adding missing ones
4. **Adding Use Cases** - Trading, social, and research automation examples
5. **Complete SDK Guide** - Comprehensive code examples for all primitives

Total files to modify: **12**
Estimated implementation time: **45-60 minutes**

