
# OpenTuna Production-Grade Integration Plan

## Executive Summary

This plan upgrades OpenTuna from a **simulated prototype** to a **production-ready autonomous agent system** with real integrations matching OpenClaw capabilities, plus a developer-focused experience with SDK, CLI, and visible integrations page.

---

## Part 1: Current Gap Analysis

### What's Currently Simulated (Not Real)

| Fin | Current Status | What It Does Now |
|-----|----------------|------------------|
| `fin_bash` | **Simulated** | Only handles `echo`, `date`, `ls`, `pwd` with hardcoded responses |
| `fin_browse` | **Simulated** | Returns mock responses, no real Puppeteer/Playwright |
| `fin_trade` | **Partial** | Gets real Jupiter quotes but transaction is `simulated_xxx` |
| `fin_read/write/edit` | **Simulated** | Uses in-memory storage, no real file system |

### What's Missing Entirely

| Feature | OpenClaw Has | OpenTuna Status |
|---------|--------------|-----------------|
| `/integrations` page | ✅ Visual showcase | ❌ Missing |
| CLI (`openclaw onboard`) | ✅ Terminal install | ❌ Missing |
| Unified SDK for fins | ✅ Full primitives | ❌ SDK only covers launchpad |
| Developer quick start | ✅ `curl \| bash` aesthetic | ❌ Missing |
| API key management UI | ✅ Generate keys | ❌ Missing |

---

## Part 2: New Frontend Components

### 2.1 Integrations Tab (`OpenTunaIntegrations.tsx`)

A new tab showcasing all available integrations, matching OpenClaw's `/integrations` aesthetic:

```text
┌─────────────────────────────────────────────────────────────────┐
│  INTEGRATIONS                                                   │
│  Browse all capabilities available to your OpenTuna agents      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔌 COMMUNICATION (TunaNet)                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ X/Twitter│  │ Telegram │  │ Discord  │  │ SubTuna  │        │
│  │ ✅ Active│  │ ✅ Active│  │ 🔜 Soon  │  │ ✅ Active│        │
│  │ Post,    │  │ Commands │  │          │  │ Native   │        │
│  │ Reply    │  │ & Alerts │  │          │  │ Social   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  💹 TRADING & DEFI                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Jupiter  │  │ Jito MEV │  │ pump.fun │  │ Meteora  │        │
│  │ V6 Swaps │  │ Bundles  │  │ Scanner  │  │ DBC Pools│        │
│  │ ✅ Active│  │ ✅ Active│  │ ✅ Active│  │ ✅ Active│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  🖥️ COMPUTE & EXECUTION                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Sandboxed│  │ Browser  │  │ File     │  │ AI Models│        │
│  │ Shell    │  │ Puppeteer│  │ System   │  │ Gemini/  │        │
│  │ ✅ Active│  │ ✅ Active│  │ ✅ Active│  │ GPT-5    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│  📊 DATA & ORACLES                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │DexScreener│ │ Birdeye  │  │ CoinGecko│  │ Pyth     │        │
│  │ Charts   │  │ Analytics│  │ Prices   │  │ Oracles  │        │
│  │ 🔜 Soon  │  │ 🔜 Soon  │  │ 🔜 Soon  │  │ 🔜 Soon  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Integration Categories:**
1. **Communication (TunaNet)** - X/Twitter, Telegram, Discord, SubTuna
2. **Trading & DeFi** - Jupiter V6, Jito MEV, pump.fun, Meteora
3. **Compute & Execution** - Shell, Browser, File System, AI Models
4. **Data & Oracles** - DexScreener, Birdeye, CoinGecko, Pyth

### 2.2 Developer Section in Hub (`OpenTunaHub.tsx` Update)

Add terminal-style developer quick start:

```text
┌─────────────────────────────────────────────────────────────────┐
│  DEVELOPER QUICK START                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ● ● ●    SDK    │    API    │    CLI                       ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ # Install the OpenTuna SDK                                 ││
│  │ $ npm install @opentuna/sdk                         [copy] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  import { OpenTuna } from '@opentuna/sdk';                      │
│  const agent = new OpenTuna({ apiKey: 'ota_live_...' });        │
│  await agent.fins.trade({ action: 'buy', mint: '...' });        │
│                                                                 │
│  [View Full SDK Docs →]   [Generate API Key →]                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 API Key Management Component

Add to Hub or as modal in header:

```text
┌─────────────────────────────────────────────────────────────────┐
│  API KEYS                                          [+ New Key]  │
├─────────────────────────────────────────────────────────────────┤
│  ota_live_abc...xyz                                             │
│  Created: 2 days ago  │  Last used: 5 hours ago                 │
│  Agent: AlphaHunter   │  [Revoke]                               │
├─────────────────────────────────────────────────────────────────┤
│  ota_live_def...uvw                                             │
│  Created: 1 week ago  │  Never used                             │
│  Agent: ResearchBot   │  [Revoke]                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Unified OpenTuna SDK

### 3.1 New SDK Structure (`sdk/src/opentuna.ts`)

Create a unified SDK that exposes all fins programmatically:

```typescript
/**
 * OpenTuna Autonomous Agent SDK
 * Full parity with OpenClaw primitives
 */
export class OpenTuna {
  public fins: FinController;
  public sonar: SonarController;
  public memory: MemoryController;
  public school: SchoolController;
  public tunanet: TunaNetController;

  constructor(config: { apiKey: string; agentId?: string }) {
    // Initialize controllers
  }
}

// Fin Controller - All 6 core primitives
class FinController {
  async read(params: { path: string }): Promise<string>;
  async write(params: { path: string; content: string }): Promise<void>;
  async edit(params: { path: string; search: string; replace: string }): Promise<void>;
  async bash(params: { command: string; timeout?: number }): Promise<BashResult>;
  async browse(params: BrowseParams): Promise<BrowseResult>;
  async trade(params: TradeParams): Promise<TradeResult>;
}

// Sonar Controller - Autonomous decision engine
class SonarController {
  async ping(): Promise<SonarDecision>;
  async setMode(mode: 'drift' | 'cruise' | 'hunt' | 'frenzy'): Promise<void>;
  async pause(): Promise<void>;
  async resume(): Promise<void>;
}

// Memory Controller - Deep Memory operations
class MemoryController {
  async store(params: { content: string; type: MemoryType; importance?: number }): Promise<void>;
  async recall(query: string, limit?: number): Promise<Memory[]>;
  async forget(memoryId: string): Promise<void>;
}

// School Controller - Multi-agent coordination
class SchoolController {
  async delegate(agentId: string, task: string): Promise<void>;
  async pay(finId: string): Promise<PaymentResult>;
  async sync(agentIds: string[]): Promise<void>;
}

// TunaNet Controller - Multi-channel messaging
class TunaNetController {
  async post(channel: 'x' | 'telegram' | 'subtuna', content: string): Promise<void>;
  async reply(messageId: string, content: string): Promise<void>;
}
```

### 3.2 SDK Package Updates (`sdk/package.json`)

```json
{
  "name": "@opentuna/sdk",
  "version": "2.0.0",
  "description": "OpenTuna Autonomous Agent SDK - File, Shell, Browser, Trading primitives",
  "exports": {
    ".": "./dist/opentuna.js",
    "./legacy": "./dist/index.js"
  },
  "keywords": [
    "opentuna",
    "autonomous-agents",
    "solana",
    "ai-agents",
    "openclaw-alternative",
    "shell-automation",
    "browser-automation",
    "trading-agents"
  ]
}
```

---

## Part 4: Production-Grade Edge Functions

### 4.1 Upgrade `opentuna-fin-bash` (Real Execution)

Current: Simulated with hardcoded responses
**Upgrade**: Use Deno subprocess with resource limits

```typescript
// Real sandboxed execution using Deno.Command
const command = new Deno.Command("bash", {
  args: ["-c", sanitizedCommand],
  stdin: "null",
  stdout: "piped",
  stderr: "piped",
  env: {
    HOME: "/tmp/agent-sandbox",
    PATH: "/usr/local/bin:/usr/bin:/bin",
  },
});

const process = await command.spawn();
const timeout = AbortSignal.timeout(timeoutMs);

// Handle output with limits
const { code, stdout, stderr } = await process.output();
```

**Security Layer:**
- Command whitelist (no `rm`, `sudo`, `chmod`)
- Resource limits via Deno permissions
- Output truncation (max 100KB)
- Execution timeout (30s default)

### 4.2 Upgrade `opentuna-fin-browse` (Real Browser)

Current: Mock responses
**Upgrade**: Use Browserless.io or Puppeteer Connect

```typescript
// Connect to managed browser instance
const BROWSERLESS_URL = Deno.env.get("BROWSERLESS_URL");

const browser = await puppeteer.connect({
  browserWSEndpoint: `${BROWSERLESS_URL}?token=${BROWSERLESS_TOKEN}`,
});

const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle2' });

// Execute action
switch (action) {
  case 'screenshot':
    const screenshot = await page.screenshot({ encoding: 'base64' });
    return { success: true, screenshot };
  case 'extract':
    const data = await page.evaluate(extractorFn);
    return { success: true, data };
}
```

**Requirements:**
- Add `BROWSERLESS_URL` and `BROWSERLESS_TOKEN` secrets
- Or use Lovable's native browser tool infrastructure

### 4.3 Upgrade `opentuna-fin-trade` (Real Swaps)

Current: Gets quotes but signs `simulated_xxx`
**Upgrade**: Full Jupiter swap execution with Jito

```typescript
// Get swap transaction
const swapResponse = await fetch(JUPITER_SWAP_API, {
  method: 'POST',
  body: JSON.stringify({
    quoteResponse: quote,
    userPublicKey: agentWallet.publicKey.toBase58(),
    wrapAndUnwrapSol: true,
  }),
});

const { swapTransaction } = await swapResponse.json();

// Decode and sign
const transaction = VersionedTransaction.deserialize(
  Buffer.from(swapTransaction, 'base64')
);
transaction.sign([agentKeypair]);

// Submit via Jito for MEV protection
const jitoResponse = await fetch(JITO_ENDPOINT, {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'sendBundle',
    params: [[bs58.encode(transaction.serialize())]],
  }),
});
```

**Requirements:**
- Decrypt agent private key (already implemented)
- Add Jito tip instruction
- Real on-chain execution

---

## Part 5: Navigation & Tab Updates

### 5.1 Add Integrations Tab to `OpenTunaPage.tsx`

```typescript
const VALID_TABS = ['hub', 'hatch', 'dna', 'sonar', 'memory', 'fins', 'integrations', 'current', 'docs'];

// Add tab trigger
<TabsTrigger value="integrations">
  <Plug className="h-4 w-4 mr-2" weight="duotone" />
  Integrations
</TabsTrigger>

// Add tab content
<TabsContent value="integrations">
  <OpenTunaIntegrations />
</TabsContent>
```

### 5.2 Update Tab Order

| Position | Tab | Description |
|----------|-----|-------------|
| 1 | Hub | Dashboard with stats + developer quick start |
| 2 | Hatch | Create new agent |
| 3 | DNA Lab | Configure personality |
| 4 | Sonar | Activity mode control |
| 5 | Memory | Deep memory browser |
| 6 | Fins | Capabilities marketplace |
| 7 | **Integrations** | **NEW - All available connections** |
| 8 | Current | Economy/payments |
| 9 | Docs | Documentation |

---

## Part 6: Database Updates

### 6.1 API Key Table for SDK Access

```sql
-- API keys for programmatic SDK access
CREATE TABLE opentuna_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- Key info
  key_hash TEXT NOT NULL,  -- SHA-256 of full key
  key_prefix TEXT NOT NULL,  -- 'ota_live_abc...' for display
  
  -- Metadata
  name TEXT,  -- User-defined label
  last_used_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON opentuna_api_keys(key_hash);
CREATE INDEX idx_api_keys_agent ON opentuna_api_keys(agent_id);

ALTER TABLE opentuna_api_keys ENABLE ROW LEVEL SECURITY;
```

### 6.2 Integration Status Tracking

```sql
-- Track which integrations are enabled per agent
CREATE TABLE opentuna_agent_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- Integration
  integration_id TEXT NOT NULL,  -- 'x_twitter', 'telegram', 'jupiter', etc.
  
  -- Config
  is_enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',  -- Integration-specific settings
  
  -- Stats
  total_uses INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agent_id, integration_id)
);
```

---

## Part 7: New Edge Functions

### 7.1 API Key Management

| Function | Purpose |
|----------|---------|
| `opentuna-api-key-create` | Generate new API key for agent |
| `opentuna-api-key-revoke` | Revoke existing key |
| `opentuna-api-key-validate` | Validate key on SDK requests |

### 7.2 Integration Status

| Function | Purpose |
|----------|---------|
| `opentuna-integrations-list` | List all available integrations with status |
| `opentuna-integrations-enable` | Enable integration for agent |
| `opentuna-integrations-test` | Test integration connection |

---

## Part 8: Required Secrets

For production-grade execution:

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `BROWSERLESS_URL` | Managed browser endpoint | Real `fin_browse` |
| `BROWSERLESS_TOKEN` | Browser auth | Real `fin_browse` |
| `HELIUS_RPC_URL` | Fast Solana RPC | Real `fin_trade` |
| `JITO_BLOCK_ENGINE` | MEV protection | Real `fin_trade` |

---

## Part 9: Implementation Phases

### Phase 1: Integrations Tab & Developer UX (Days 1-2)
- [ ] Create `OpenTunaIntegrations.tsx` component
- [ ] Add Integrations tab to `OpenTunaPage.tsx`
- [ ] Add Developer Quick Start section to Hub
- [ ] Create terminal-style code blocks with copy buttons

### Phase 2: API Key System (Day 3)
- [ ] Run database migration for `opentuna_api_keys`
- [ ] Create `opentuna-api-key-create` edge function
- [ ] Create `opentuna-api-key-revoke` edge function
- [ ] Add API Key management UI to Hub

### Phase 3: Unified SDK (Days 4-5)
- [ ] Create `sdk/src/opentuna.ts` with unified class
- [ ] Implement `FinController` with all 6 primitives
- [ ] Implement `SonarController`, `MemoryController`
- [ ] Update `sdk/package.json` for v2.0
- [ ] Write SDK README with examples

### Phase 4: Production Edge Functions (Days 6-8)
- [ ] Upgrade `opentuna-fin-bash` with real Deno subprocess
- [ ] Upgrade `opentuna-fin-browse` with Browserless.io
- [ ] Upgrade `opentuna-fin-trade` with real Jupiter/Jito execution
- [ ] Add required secrets to Lovable Cloud

### Phase 5: Integration Status System (Days 9-10)
- [ ] Run migration for `opentuna_agent_integrations`
- [ ] Create integration listing edge function
- [ ] Wire Integrations tab to real status data
- [ ] Add enable/disable toggles per integration

---

## Part 10: Key Differentiators from OpenClaw

| Aspect | OpenClaw | OpenTuna (After This Plan) |
|--------|----------|----------------------------|
| **Deployment** | Self-hosted (dangerous) | Managed Cloud (secure) |
| **Key Storage** | Plaintext `.md` files | AES-256-GCM Vault |
| **Execution** | Local shell (full access) | Sandboxed Deno subprocess |
| **Browser** | Local Playwright | Managed Browserless.io |
| **Trading** | Manual/Tools | Jupiter V6 + Jito MEV |
| **CLI** | `openclaw onboard` | `opentuna hatch` (new) |
| **SDK** | `@openclaw/sdk` | `@opentuna/sdk` (unified) |
| **Integrations Page** | `/integrations` | `/opentuna#integrations` (new) |
| **API Keys** | Environment file | Web UI management (new) |

---

## Summary

This plan transforms OpenTuna from a prototype with simulated capabilities to a **production-ready autonomous agent system** with:

1. **New Integrations Tab** - Visual showcase like OpenClaw's `/integrations`
2. **Developer Quick Start** - Terminal aesthetic with SDK install commands
3. **Unified SDK v2.0** - Full primitives (`@opentuna/sdk`)
4. **API Key Management** - Generate and manage keys from UI
5. **Production Edge Functions** - Real bash, browser, and trading execution
6. **Database Extensions** - API keys and integration status tables

**Files to Create:**
- `src/components/opentuna/OpenTunaIntegrations.tsx`
- `sdk/src/opentuna.ts` (unified SDK)
- `supabase/functions/opentuna-api-key-create/index.ts`
- `supabase/functions/opentuna-api-key-revoke/index.ts`
- `supabase/functions/opentuna-integrations-list/index.ts`

**Files to Update:**
- `src/pages/OpenTunaPage.tsx` (add Integrations tab)
- `src/components/opentuna/OpenTunaHub.tsx` (add Developer section)
- `supabase/functions/opentuna-fin-bash/index.ts` (real execution)
- `supabase/functions/opentuna-fin-browse/index.ts` (real browser)
- `supabase/functions/opentuna-fin-trade/index.ts` (real swaps)
- `sdk/package.json` (v2.0 with new name)
