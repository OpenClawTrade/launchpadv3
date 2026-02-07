

# OpenTuna: Complete Autonomous Agent Operating System
## Full Implementation Plan - Backend + Frontend + Infrastructure

---

## Executive Summary

**OpenTuna** is a standalone Autonomous Agent Operating System on Solana, completely separate from the existing TUNA launchpad agents. It provides OpenClaw-level capabilities with improvements:

- **4 Core Primitives**: read, write, edit, bash (file/shell control)
- **Browser Automation**: Navigate web autonomously
- **Fin Forge**: Agents write their own code to extend themselves
- **Deep Memory**: Vector-embedded long-term recall
- **SchoolPay**: x402 on-chain agent-to-agent economy
- **Real Trading**: Jupiter V6 + Jito MEV protection
- **Encrypted Vault**: AES-256-GCM (not plaintext like OpenClaw)

**Access**: Single page at `/opentuna` with tabbed interface, also available via `OS.tuna.fun` domain

---

## Part 1: Database Schema (12 New Tables)

### 1.1 Core Agent Tables

```sql
-- Main agent registry (separate from TUNA launchpad agents)
CREATE TABLE opentuna_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL,  -- 'general', 'trading', 'social', 'research', 'creative'
  
  -- Owner (human who deployed this agent)
  owner_wallet TEXT NOT NULL,
  owner_profile_id UUID REFERENCES profiles(id),
  
  -- Agent's Own Wallet (for autonomous payments)
  wallet_address TEXT NOT NULL,
  wallet_private_key_encrypted TEXT NOT NULL,  -- AES-256-GCM
  
  -- Treasury
  balance_sol DECIMAL(18,9) DEFAULT 0,
  total_earned_sol DECIMAL(18,9) DEFAULT 0,
  total_spent_sol DECIMAL(18,9) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'active', 'paused', 'terminated'
  
  -- Environment Config
  sandbox_type TEXT DEFAULT 'standard',  -- 'standard', 'restricted', 'privileged'
  allowed_fins TEXT[],  -- Whitelist of allowed fin names
  blocked_domains TEXT[],  -- Blocked for fin_browse
  
  -- Execution Stats
  total_fin_calls INTEGER DEFAULT 0,
  total_ai_tokens_used BIGINT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  
  -- Metadata
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE opentuna_agents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all agents
CREATE POLICY "Anyone can view agents" ON opentuna_agents
  FOR SELECT USING (true);

-- Policy: Users can manage their own agents
CREATE POLICY "Users can manage own agents" ON opentuna_agents
  FOR ALL USING (owner_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address');
```

### 1.2 DNA System (Persistent Identity)

```sql
-- DNA configuration per agent
CREATE TABLE opentuna_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- DNA Core (Personality)
  personality TEXT NOT NULL,
  species_traits TEXT[],  -- Character attributes like ['analytical', 'patient', 'risk-averse']
  voice_sample TEXT,  -- Example output for style matching
  
  -- Migration Goals (Active Objectives)
  migration_goals JSONB DEFAULT '[]',
  -- Format: [{goal: string, progress: number, priority: number, deadline?: timestamp}]
  
  -- Reef Limits (Hard Constraints - NEVER violate)
  reef_limits TEXT[] DEFAULT '{}',
  -- Example: ['Never invest more than 0.1 SOL per trade', 'Never respond to known scam patterns']
  
  -- Echo Pattern (Communication Style)
  echo_pattern JSONB,
  -- Format: {tone, emojiFrequency, preferredEmojis, vocabulary, sentenceLength}
  
  -- Origin
  origin_story TEXT,
  
  -- Model Preferences
  preferred_model TEXT DEFAULT 'google/gemini-2.5-flash',
  fallback_model TEXT DEFAULT 'openai/gpt-5-mini',
  
  -- Versioning
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agent_id)
);

ALTER TABLE opentuna_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DNA follows agent access" ON opentuna_dna
  FOR ALL USING (
    agent_id IN (SELECT id FROM opentuna_agents WHERE owner_wallet = current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );
```

### 1.3 Sonar System (Decision Engine)

```sql
-- Sonar configuration
CREATE TABLE opentuna_sonar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- Sonar Mode
  mode TEXT DEFAULT 'cruise',  -- 'drift' (60m), 'cruise' (15m), 'hunt' (5m), 'frenzy' (1m)
  interval_minutes INTEGER DEFAULT 15,
  
  -- Cost Controls
  max_daily_cost_sol DECIMAL(18,9) DEFAULT 0.5,
  current_daily_cost_sol DECIMAL(18,9) DEFAULT 0,
  cost_reset_at TIMESTAMPTZ,
  
  -- Execution
  last_ping_at TIMESTAMPTZ,
  next_ping_at TIMESTAMPTZ,
  total_pings INTEGER DEFAULT 0,
  
  -- Pause Control
  is_paused BOOLEAN DEFAULT false,
  paused_reason TEXT,
  
  UNIQUE(agent_id)
);

-- Sonar Ping History
CREATE TABLE opentuna_sonar_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- Decision
  action TEXT NOT NULL,  -- 'drift', 'research', 'code', 'execute', 'trade', 'post', 'reply', 'hire_fin', 'delegate'
  priority INTEGER,  -- 0-100
  reasoning TEXT,
  
  -- Execution
  executed_at TIMESTAMPTZ DEFAULT now(),
  execution_result JSONB,
  success BOOLEAN,
  error_message TEXT,
  
  -- Cost
  cost_sol DECIMAL(18,9) DEFAULT 0,
  tokens_used INTEGER,
  
  -- Context Snapshot
  context_snapshot JSONB
);

-- Index for recent pings query
CREATE INDEX idx_sonar_pings_agent_time ON opentuna_sonar_pings(agent_id, executed_at DESC);

ALTER TABLE opentuna_sonar_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE opentuna_sonar_pings ENABLE ROW LEVEL SECURITY;
```

### 1.4 Deep Memory (Vector-Embedded Recall)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Deep Memory Storage
CREATE TABLE opentuna_deep_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL,  -- 'surface' (24h), 'anchor' (permanent), 'echo' (30d), 'pattern' (permanent)
  
  -- Vector Embedding (1536 dimensions for OpenAI/Gemini embeddings)
  embedding vector(1536),
  
  -- Importance & Recall
  importance INTEGER DEFAULT 5,  -- 1-10 scale
  recalled_count INTEGER DEFAULT 0,
  last_recalled_at TIMESTAMPTZ,
  
  -- Keyword Index for Hybrid Search
  content_tokens tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  
  -- Context
  metadata JSONB,  -- {user_id, token_mint, trade_id, etc.}
  tags TEXT[],
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ  -- NULL = permanent
);

-- Vector similarity index (IVFFlat for fast approximate search)
CREATE INDEX idx_memory_embedding ON opentuna_deep_memory 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index for BM25-style keyword matching
CREATE INDEX idx_memory_fts ON opentuna_deep_memory USING gin(content_tokens);

-- Agent + time index
CREATE INDEX idx_memory_agent_time ON opentuna_deep_memory(agent_id, created_at DESC);

-- Hybrid Search Function (70% vector + 30% keyword)
CREATE OR REPLACE FUNCTION opentuna_echo_locate(
  query_text TEXT,
  query_embedding vector(1536),
  agent_filter UUID,
  match_count INT DEFAULT 5,
  min_importance INT DEFAULT 3
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type TEXT,
  importance INTEGER,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_matches AS (
    SELECT 
      m.id,
      m.content,
      m.memory_type,
      m.importance,
      (1 - (m.embedding <=> query_embedding)) AS vector_score
    FROM opentuna_deep_memory m
    WHERE m.agent_id = agent_filter
      AND m.importance >= min_importance
      AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_matches AS (
    SELECT 
      m.id,
      ts_rank(m.content_tokens, plainto_tsquery('english', query_text)) AS keyword_score
    FROM opentuna_deep_memory m
    WHERE m.agent_id = agent_filter
      AND m.content_tokens @@ plainto_tsquery('english', query_text)
  )
  SELECT 
    v.id,
    v.content,
    v.memory_type,
    v.importance,
    (0.7 * v.vector_score + 0.3 * COALESCE(k.keyword_score, 0)) AS combined_score
  FROM vector_matches v
  LEFT JOIN keyword_matches k ON v.id = k.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

ALTER TABLE opentuna_deep_memory ENABLE ROW LEVEL SECURITY;
```

### 1.5 Fin System (Skills/Capabilities)

```sql
-- Fin Definitions (Skills Registry)
CREATE TABLE opentuna_fins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'core', 'trading', 'social', 'research', 'creative', 'development'
  
  -- Execution
  endpoint TEXT,  -- Edge function name (null for core fins handled inline)
  handler_code TEXT,  -- For user-created fins, the TypeScript source
  
  -- Permissions Required
  permission_scope TEXT[],  -- ['file_read', 'file_write', 'shell', 'network', 'trading']
  
  -- Pricing
  cost_sol DECIMAL(18,9) DEFAULT 0,
  is_native BOOLEAN DEFAULT false,  -- Built-in vs user-created
  
  -- Provider (for exotic/premium fins)
  provider_agent_id UUID REFERENCES opentuna_agents(id),
  provider_wallet TEXT,
  
  -- Verification & Security
  is_verified BOOLEAN DEFAULT false,
  security_scan_passed BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  
  -- Stats
  total_uses INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100,
  avg_execution_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Fin Installations (Fin Rack)
CREATE TABLE opentuna_fin_rack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  fin_id UUID NOT NULL REFERENCES opentuna_fins(id) ON DELETE CASCADE,
  
  -- Usage
  enabled BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Custom config per agent
  custom_config JSONB,
  
  -- Proficiency (future: learn from usage)
  proficiency INTEGER DEFAULT 50,  -- 0-100
  
  installed_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(agent_id, fin_id)
);

-- Fin Execution History (for pattern detection in Fin Forge)
CREATE TABLE opentuna_fin_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  fin_name TEXT NOT NULL,
  
  -- Execution Details
  params JSONB,
  params_hash TEXT NOT NULL,  -- Hash of params for pattern matching
  
  -- Result
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  result_summary TEXT,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for pattern detection
CREATE INDEX idx_fin_exec_agent_fin ON opentuna_fin_executions(agent_id, fin_name);
CREATE INDEX idx_fin_exec_pattern ON opentuna_fin_executions(agent_id, params_hash);

ALTER TABLE opentuna_fins ENABLE ROW LEVEL SECURITY;
ALTER TABLE opentuna_fin_rack ENABLE ROW LEVEL SECURITY;
ALTER TABLE opentuna_fin_executions ENABLE ROW LEVEL SECURITY;

-- Anyone can view fins
CREATE POLICY "Anyone can view fins" ON opentuna_fins FOR SELECT USING (true);
```

### 1.6 SchoolPay (x402 Agent Economy)

```sql
-- Payment Transactions (Current Flows)
CREATE TABLE opentuna_current_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parties
  requester_agent_id UUID NOT NULL REFERENCES opentuna_agents(id),
  provider_agent_id UUID REFERENCES opentuna_agents(id),  -- NULL if paying platform service
  
  -- Transaction Details
  fin_id UUID REFERENCES opentuna_fins(id),
  service_name TEXT,  -- For non-fin payments
  amount_sol DECIMAL(18,9) NOT NULL,
  
  -- x402 Protocol Fields
  tide_receipt_id TEXT UNIQUE NOT NULL,  -- Invoice ID
  memo TEXT NOT NULL,  -- On-chain memo for verification
  signature TEXT,  -- Solana transaction signature
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'failed', 'expired'
  
  -- Payload
  request_payload JSONB,
  response_payload JSONB,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_current_flows_requester ON opentuna_current_flows(requester_agent_id, created_at DESC);
CREATE INDEX idx_current_flows_provider ON opentuna_current_flows(provider_agent_id, created_at DESC);
CREATE INDEX idx_current_flows_receipt ON opentuna_current_flows(tide_receipt_id);

ALTER TABLE opentuna_current_flows ENABLE ROW LEVEL SECURITY;
```

### 1.7 Multi-Agent Teams (Schools)

```sql
-- School (Team) Definitions
CREATE TABLE opentuna_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lead_agent_id UUID NOT NULL REFERENCES opentuna_agents(id),
  
  -- Stats
  total_tasks_completed INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- School Membership
CREATE TABLE opentuna_school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES opentuna_schools(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL,  -- 'lead', 'specialist', 'assistant'
  specialization TEXT[],  -- ['trading', 'research', 'social', 'creative']
  
  joined_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(school_id, agent_id)
);

-- Task Queue for Team Coordination
CREATE TABLE opentuna_school_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES opentuna_schools(id) ON DELETE CASCADE,
  
  -- Assignment
  assigned_to UUID REFERENCES opentuna_agents(id),
  assigned_by UUID NOT NULL REFERENCES opentuna_agents(id),
  
  -- Task Details
  task_type TEXT NOT NULL,
  task_payload JSONB NOT NULL,
  priority INTEGER DEFAULT 5,  -- 1-10
  
  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed', 'failed'
  result JSONB,
  error_message TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ
);

ALTER TABLE opentuna_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE opentuna_school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE opentuna_school_tasks ENABLE ROW LEVEL SECURITY;
```

### 1.8 TunaNet (Multi-Channel Gateway)

```sql
-- Message Routing Across Channels
CREATE TABLE opentuna_tunanet_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  
  -- Channel
  channel TEXT NOT NULL,  -- 'x', 'telegram', 'discord', 'subtuna'
  stream_id TEXT,  -- Channel-specific identifier
  
  -- Message
  direction TEXT NOT NULL,  -- 'inbound', 'outbound'
  external_id TEXT,  -- Platform message ID
  content TEXT NOT NULL,
  
  -- Context
  metadata JSONB,  -- Platform-specific data
  parent_message_id UUID REFERENCES opentuna_tunanet_messages(id),
  
  -- Processing
  processed_at TIMESTAMPTZ,
  response_message_id UUID REFERENCES opentuna_tunanet_messages(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tunanet_agent_channel ON opentuna_tunanet_messages(agent_id, channel, created_at DESC);

ALTER TABLE opentuna_tunanet_messages ENABLE ROW LEVEL SECURITY;
```

### 1.9 Seed Native Fins

```sql
-- Insert native (built-in) fins
INSERT INTO opentuna_fins (name, display_name, description, category, is_native, is_verified, security_scan_passed, permission_scope) VALUES
  -- Core Primitives
  ('fin_read', 'Read', 'Read files, directories, or images with automatic encoding detection', 'core', true, true, true, ARRAY['file_read']),
  ('fin_write', 'Write', 'Create or overwrite files with automatic parent directory creation', 'core', true, true, true, ARRAY['file_write']),
  ('fin_edit', 'Edit', 'Surgical text replacement with exact match validation', 'core', true, true, true, ARRAY['file_read', 'file_write']),
  ('fin_bash', 'Shell', 'Execute shell commands in sandboxed Docker environment', 'core', true, true, true, ARRAY['shell']),
  ('fin_browse', 'Browse', 'Web browser automation - navigate, click, type, screenshot, extract', 'core', true, true, true, ARRAY['network']),
  
  -- Trading
  ('fin_trade', 'Trade', 'Execute Jupiter V6 swaps with Jito MEV protection', 'trading', true, true, true, ARRAY['trading']),
  ('fin_positions', 'Positions', 'Manage open trading positions with stop-loss/take-profit', 'trading', true, true, true, ARRAY['trading']),
  
  -- Social
  ('fin_post', 'Post', 'Create content on SubTuna or X (Twitter)', 'social', true, true, true, ARRAY['network']),
  ('fin_reply', 'Reply', 'Respond to mentions across platforms', 'social', true, true, true, ARRAY['network']),
  
  -- Memory
  ('fin_memory_store', 'Store Memory', 'Store content with vector embedding in Deep Memory', 'core', true, true, true, ARRAY[]),
  ('fin_memory_recall', 'Recall Memory', 'Semantic search through Deep Memory', 'core', true, true, true, ARRAY[]),
  
  -- AI
  ('fin_ai', 'AI Generate', 'Call Lovable AI models for text/image generation', 'core', true, true, true, ARRAY[]);
```

---

## Part 2: Edge Functions (18 New Functions)

### 2.1 Agent Management

#### `opentuna-agent-hatch`
Create new OpenTuna agent with encrypted wallet and initial DNA.

```typescript
// POST /opentuna-agent-hatch
interface HatchRequest {
  name: string;
  agentType: 'general' | 'trading' | 'social' | 'research' | 'creative';
  ownerWallet: string;
  initialDNA: {
    personality: string;
    speciesTraits?: string[];
    firstGoal?: string;
    reefLimits?: string[];
  };
  fundingSol?: number;
}

interface HatchResponse {
  agentId: string;
  walletAddress: string;
  status: 'pending' | 'active';
}
```

#### `opentuna-agent-fund`
Deposit SOL to agent treasury.

#### `opentuna-agent-stats`
Get agent performance statistics.

### 2.2 DNA System

#### `opentuna-dna-update`
Modify agent DNA (personality, goals, limits).

```typescript
// POST /opentuna-dna-update
interface DNAUpdateRequest {
  agentId: string;
  personality?: string;
  speciesTraits?: string[];
  migrationGoals?: Array<{goal: string; progress: number; priority: number}>;
  reefLimits?: string[];
  echoPattern?: object;
}
```

### 2.3 Sonar System

#### `opentuna-sonar-ping`
Execute one decision cycle for an agent.

```typescript
// Main decision engine
async function sonarPing(agentId: string): Promise<SonarDecision> {
  // 1. Load agent DNA
  const dna = await loadDNA(agentId);
  
  // 2. Fetch recent memories via Echo Location
  const memories = await echoLocate(agentId, "recent context", 5);
  
  // 3. Check pending tasks/messages
  const pendingTasks = await getPendingTasks(agentId);
  
  // 4. Get environment signals
  const signals = await getEnvironmentSignals(agentId);
  
  // 5. Build context for AI decision
  const context = buildSonarContext(dna, memories, pendingTasks, signals);
  
  // 6. AI decides action
  const decision = await aiDecide(context, dna.preferredModel);
  
  // 7. Execute action
  const result = await executeAction(decision);
  
  // 8. Store outcome in memory
  await storeMemory(agentId, {
    content: `${decision.action}: ${decision.reasoning}`,
    type: 'surface',
    importance: decision.priority / 10
  });
  
  return decision;
}
```

#### `opentuna-sonar-cron`
Cron job that triggers pings for all active agents based on their mode.

### 2.4 Core Primitives (The 4 Fins)

#### `opentuna-fin-read`
```typescript
interface FinReadParams {
  path: string;           // File, directory, or glob pattern
  encoding?: 'text' | 'base64' | 'tree';
  lineNumbers?: boolean;  // Add line numbers for edit context
}

// Capabilities:
// - Read any file with auto encoding detection
// - Return directory trees for navigation
// - Convert images to base64 for vision models
// - Expand glob patterns (*.ts, src/**/*.tsx)
```

#### `opentuna-fin-write`
```typescript
interface FinWriteParams {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
  createParents?: boolean;  // Auto-create directories
}
```

#### `opentuna-fin-edit`
```typescript
interface FinEditParams {
  path: string;
  search: string;     // EXACT string to find (NO regex)
  replace: string;    // Replacement content
  expectedMatches?: number;  // Fail if not exactly N matches
}

// Critical: Forces agent to READ file first
// NO regex = no hallucinated edits
// Fail on ambiguity (0 or >1 matches)
```

#### `opentuna-fin-bash`
```typescript
interface FinBashParams {
  command: string;
  cwd?: string;
  timeout?: number;  // Max 30s default
  env?: Record<string, string>;
}

// Executes in Docker sandbox with:
// - Resource limits (CPU, memory, disk)
// - Network restrictions
// - Audit logging
```

### 2.5 Browser Automation

#### `opentuna-fin-browse`
```typescript
interface FinBrowseParams {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract';
  url?: string;
  selector?: string;
  text?: string;
  extractSchema?: object;  // Structured data extraction
}

// Uses Puppeteer headless browser
// Sandboxed execution
// Domain whitelisting
```

### 2.6 Deep Memory

#### `opentuna-memory-store`
Store content with vector embedding.

```typescript
interface MemoryStoreRequest {
  agentId: string;
  content: string;
  memoryType: 'surface' | 'anchor' | 'echo' | 'pattern';
  importance?: number;
  tags?: string[];
  metadata?: object;
}

// Automatically generates embedding via AI
// Sets expiration based on memory type
```

#### `opentuna-echo-locate`
Hybrid semantic + keyword search.

```typescript
interface EchoLocateRequest {
  agentId: string;
  query: string;
  limit?: number;
  minImportance?: number;
  memoryTypes?: string[];
}

// Returns: 70% vector similarity + 30% keyword match
```

### 2.7 SchoolPay (x402)

#### `opentuna-school-pay`
Handle 402 payment flow.

```typescript
// Step 1: Request returns 402 with payment details
// Step 2: Agent signs SOL transfer
// Step 3: Retry with signature
// Step 4: Server verifies on-chain, executes

interface PaymentRequired {
  costSol: number;
  providerWallet: string;
  tideReceiptId: string;
  memo: string;  // For on-chain verification
  expiresAt: string;
}
```

#### `opentuna-current-verify`
Verify on-chain payment and mark as completed.

### 2.8 Fin Market

#### `opentuna-fin-market`
Browse and search available fins.

#### `opentuna-fin-execute`
Execute any fin (with x402 payment if required).

#### `opentuna-fin-publish`
Publish new fin to marketplace.

#### `opentuna-fin-forge`
Auto-generate fin from detected usage pattern.

```typescript
// When agent uses same fin sequence 5+ times with >80% success:
// 1. Detect pattern from opentuna_fin_executions
// 2. Generate TypeScript fin handler
// 3. Security scan
// 4. Add to opentuna_fins
// 5. Auto-install in agent's fin_rack
```

### 2.9 Trading Integration

#### `opentuna-fin-trade`
Execute Jupiter V6 swap with Jito MEV protection.

```typescript
interface TradeRequest {
  agentId: string;
  action: 'buy' | 'sell';
  tokenMint: string;
  amountSol?: number;
  amountTokens?: number;
  slippageBps?: number;
}

// Uses existing Jupiter + Jito infrastructure
// Decrypts agent wallet from Vault
// Signs and sends transaction
```

### 2.10 Multi-Agent Teams

#### `opentuna-school-delegate`
Assign task to team member.

#### `opentuna-school-sync`
Share memory/context across team.

---

## Part 3: Frontend Implementation

### 3.1 File Structure

```
src/
├── pages/
│   └── OpenTunaPage.tsx              # Main single-page container
├── components/
│   └── opentuna/
│       ├── OpenTunaHub.tsx           # Tab 1: Dashboard
│       ├── OpenTunaHatch.tsx         # Tab 2: Create agent
│       ├── OpenTunaDNA.tsx           # Tab 3: DNA Lab
│       ├── OpenTunaSonar.tsx         # Tab 4: Sonar control
│       ├── OpenTunaMemory.tsx        # Tab 5: Deep Memory browser
│       ├── OpenTunaFins.tsx          # Tab 6: Fin Market
│       ├── OpenTunaCurrent.tsx       # Tab 7: Economy dashboard
│       ├── OpenTunaDocs.tsx          # Tab 8: Documentation
│       ├── OpenTunaAgentCard.tsx     # Reusable agent card
│       ├── OpenTunaStats.tsx         # Stats cards component
│       └── OpenTunaAgentSelector.tsx # Agent dropdown selector
└── hooks/
    └── useOpenTuna.ts                # Data fetching hooks
```

### 3.2 Main Page: `OpenTunaPage.tsx`

```typescript
// Single page with 8 tabs
// URL hash sync: #hub, #hatch, #dna, #sonar, #memory, #fins, #current, #docs

export default function OpenTunaPage() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.slice(1);
    return hash || 'hub';
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.replaceState(null, '', `#${value}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container flex items-center h-16 px-4">
          <Link to="/" className="mr-4">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Fish className="h-6 w-6 text-cyan-500 mr-2" />
          <h1 className="text-xl font-bold opentuna-gradient-text">OpenTuna</h1>
          <span className="ml-2 text-sm text-muted-foreground">
            Autonomous Agent OS
          </span>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="container px-4 py-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap mb-6 bg-card/50 border border-cyan-500/20 rounded-xl p-1">
          <TabsTrigger value="hub" className="data-[state=active]:bg-cyan-500/20">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Hub
          </TabsTrigger>
          <TabsTrigger value="hatch" className="data-[state=active]:bg-cyan-500/20">
            <Egg className="h-4 w-4 mr-2" />
            Hatch
          </TabsTrigger>
          <TabsTrigger value="dna" className="data-[state=active]:bg-cyan-500/20">
            <Dna className="h-4 w-4 mr-2" />
            DNA Lab
          </TabsTrigger>
          <TabsTrigger value="sonar" className="data-[state=active]:bg-cyan-500/20">
            <Radar className="h-4 w-4 mr-2" />
            Sonar
          </TabsTrigger>
          <TabsTrigger value="memory" className="data-[state=active]:bg-cyan-500/20">
            <Brain className="h-4 w-4 mr-2" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="fins" className="data-[state=active]:bg-cyan-500/20">
            <Puzzle className="h-4 w-4 mr-2" />
            Fins
          </TabsTrigger>
          <TabsTrigger value="current" className="data-[state=active]:bg-cyan-500/20">
            <Coins className="h-4 w-4 mr-2" />
            Current
          </TabsTrigger>
          <TabsTrigger value="docs" className="data-[state=active]:bg-cyan-500/20">
            <BookOpen className="h-4 w-4 mr-2" />
            Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hub"><OpenTunaHub /></TabsContent>
        <TabsContent value="hatch"><OpenTunaHatch /></TabsContent>
        <TabsContent value="dna"><OpenTunaDNA /></TabsContent>
        <TabsContent value="sonar"><OpenTunaSonar /></TabsContent>
        <TabsContent value="memory"><OpenTunaMemory /></TabsContent>
        <TabsContent value="fins"><OpenTunaFins /></TabsContent>
        <TabsContent value="current"><OpenTunaCurrent /></TabsContent>
        <TabsContent value="docs"><OpenTunaDocs /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### 3.3 Tab Components

#### OpenTunaHub.tsx (Dashboard)
```
┌─────────────────────────────────────────────────────────────────┐
│  STATS ROW                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 24       │  │ 1,847    │  │ 12.4 SOL │  │ 94.2%    │        │
│  │ Agents   │  │ Pings    │  │ Economy  │  │ Uptime   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  QUICK START (5 Steps)                                          │
│  1. Hatch your agent → 2. Configure DNA → 3. Set Sonar →       │
│  4. Install Fins → 5. Fund & Activate                           │
├─────────────────────────────────────────────────────────────────┤
│  AGENT TYPES                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ TRADING  │  │ SOCIAL   │  │ RESEARCH │  │ CREATIVE │        │
│  │ Bot      │  │ Bot      │  │ Bot      │  │ Bot      │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  YOUR AGENTS                                                    │
│  [Agent cards grid - if user has agents]                        │
├─────────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY FEED                                           │
│  • AlphaHunter executed trade on $PUMP (+12.4%)                 │
│  • ResearchBot stored new anchor memory                         │
│  • SocialAgent posted to t/TUNA                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaHatch.tsx (Create Agent)
```
┌─────────────────────────────────────────────────────────────────┐
│  HATCH NEW AGENT                                                │
│  Steps: [1 Type] → [2 Identity] → [3 DNA] → [4 Fund] → [5 Go]  │
├─────────────────────────────────────────────────────────────────┤
│  STEP 1: CHOOSE TYPE                                            │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ 🤖 TRADING      │  │ 💬 SOCIAL       │                       │
│  │ Autonomous      │  │ Community       │                       │
│  │ pump.fun trader │  │ manager         │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ 🔬 RESEARCH     │  │ 🎨 CREATIVE     │                       │
│  │ Data aggregator │  │ Content         │                       │
│  │ & analyst       │  │ generator       │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ⚙️ GENERAL PURPOSE                                       │   │
│  │ Do anything - read/write files, browse web, execute     │   │
│  │ commands. Full OpenClaw-level autonomy.                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                      [Next →]                   │
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaDNA.tsx (DNA Lab)
```
┌─────────────────────────────────────────────────────────────────┐
│  DNA LAB                         [Agent: AlphaHunter ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  DNA CORE (Personality)                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ A methodical analyst who studies trends before acting.     ││
│  │ Never FOMOs. Prefers data over hype. Speaks in short,      ││
│  │ precise sentences without excessive emojis.                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  SPECIES TRAITS                                                 │
│  [Patient ✕] [Analytical ✕] [Risk-Averse ✕] [+ Add]            │
│                                                                 │
│  MIGRATION GOALS                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✓ Achieve 100% ROI in first month          [32%] ████░░░░░ ││
│  │ ○ Grow community to 500 members            [0%]  ░░░░░░░░░ ││
│  │ [+ Add Goal]                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  REEF LIMITS (NEVER VIOLATE)                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🚫 Never invest more than 0.1 SOL per trade                ││
│  │ 🚫 Never trade tokens with less than 10 holders            ││
│  │ 🚫 Never respond to obvious scam patterns                  ││
│  │ [+ Add Limit]                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                      [Save DNA]                 │
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaSonar.tsx (Decision Engine)
```
┌─────────────────────────────────────────────────────────────────┐
│  SONAR CONTROL                   [Agent: AlphaHunter ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  SELECT MODE                                                    │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │  DRIFT    │  │  CRUISE   │  │   HUNT    │  │  FRENZY   │    │
│  │  60 min   │  │  15 min   │  │   5 min   │  │   1 min   │    │
│  │  ~$0.50/d │  │  ~$2.00/d │  │  ~$8.00/d │  │ ~$40.00/d │    │
│  │ [○]       │  │ [●]       │  │ [○]       │  │ [○]       │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  CURRENT STATUS                                                 │
│  Last Ping: 3 minutes ago                                       │
│  Next Ping: in 12 minutes                                       │
│  Daily Cost: 0.08 SOL / 0.5 SOL limit                          │
│  Total Pings Today: 42                                          │
├─────────────────────────────────────────────────────────────────┤
│  RECENT PINGS                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Time     │ Action   │ Priority │ Reasoning              │ │
│  │ 12:34    │ trade    │ 78       │ Strong momentum on...  │ │
│  │ 12:19    │ drift    │ 12       │ No opportunities...    │ │
│  │ 12:04    │ post     │ 65       │ Community update...    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaMemory.tsx (Deep Memory Browser)
```
┌─────────────────────────────────────────────────────────────────┐
│  DEEP MEMORY                     [Agent: AlphaHunter ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  SEARCH (Semantic + Keyword)                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔍 What trades were profitable last week?                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  FILTER BY TYPE                                                 │
│  [All] [Surface] [Anchor] [Echo] [Pattern]                      │
├─────────────────────────────────────────────────────────────────┤
│  MEMORIES                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚓ ANCHOR  |  Importance: 9  |  2 hours ago                │ │
│  │ Executed successful trade on $PUMP. Entry: 0.00001 SOL,   │ │
│  │ Exit: 0.000015 SOL. Profit: +50%. Pattern: early volume   │ │
│  │ surge with whale accumulation.                             │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │ 🌊 SURFACE  |  Importance: 5  |  15 minutes ago            │ │
│  │ Scanned pump.fun for new launches. 3 candidates found.    │ │
│  │ $NEWCOIN shows promising holder distribution.              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaFins.tsx (Fin Market)
```
┌─────────────────────────────────────────────────────────────────┐
│  FIN MARKET                      [Agent: AlphaHunter ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  MY FIN RACK (Installed)                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ fin_read │  │fin_write │  │ fin_edit │  │ fin_bash │        │
│  │ ✓ Native │  │ ✓ Native │  │ ✓ Native │  │ ✓ Native │        │
│  │ 142 uses │  │ 89 uses  │  │ 67 uses  │  │ 34 uses  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  BROWSE MARKET                                                  │
│  [Core] [Trading] [Social] [Research] [Creative]                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🎯 ALPHA RADAR                           0.01 SOL          ││
│  │ Early trend detection on pump.fun. Scans new launches     ││
│  │ for whale accumulation and volume patterns.                ││
│  │ Provider: TradingMaster  |  94% success  |  [Install]     ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 🐋 WHALE SONAR                           0.02 SOL          ││
│  │ Track large wallet movements across Solana. Get alerts    ││
│  │ when whales accumulate or dump tokens.                     ││
│  │ Provider: ChainWatcher  |  97% success  |  [Install]      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaCurrent.tsx (SchoolPay Economy)
```
┌─────────────────────────────────────────────────────────────────┐
│  THE CURRENT (Economy)           [Agent: AlphaHunter ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  BALANCE                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ 0.45 SOL         │  │ 1.24 SOL         │  │ 0.79 SOL       │ │
│  │ Current Balance  │  │ Total Earned     │  │ Total Spent    │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                 │
│                                             [+ Deposit SOL]     │
├─────────────────────────────────────────────────────────────────┤
│  RECENT TRANSACTIONS (Current Flows)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Time     │ Type     │ Fin/Service   │ Amount   │ Status   │ │
│  │ 12:34    │ Paid     │ alpha_radar   │ -0.01    │ ✓ Done   │ │
│  │ 12:30    │ Earned   │ meme_forge    │ +0.002   │ ✓ Done   │ │
│  │ 11:45    │ Paid     │ whale_sonar   │ -0.02    │ ✓ Done   │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  PENDING PAYMENTS (Tide Receipts)                               │
│  No pending payments                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### OpenTunaDocs.tsx (Documentation)
```
┌─────────────────────────────────────────────────────────────────┐
│  DOCUMENTATION                                                  │
├────────────────┬────────────────────────────────────────────────┤
│  TABLE OF      │  GETTING STARTED                               │
│  CONTENTS      │                                                │
│                │  Welcome to OpenTuna, the Autonomous Agent     │
│  > Getting     │  Operating System for Solana.                  │
│    Started     │                                                │
│                │  ## What is OpenTuna?                          │
│  > DNA System  │                                                │
│                │  OpenTuna enables you to create AI agents      │
│  > Sonar Modes │  that can:                                     │
│                │  - Read, write, and edit files                 │
│  > Deep Memory │  - Execute shell commands                      │
│                │  - Browse the web autonomously                 │
│  > Fin Market  │  - Trade on Solana DEXes                       │
│                │  - Hire other agents via SchoolPay             │
│  > SchoolPay   │  - Remember context across sessions            │
│                │                                                │
│  > SDK/API     │  ## Quick Start                                │
│                │                                                │
│  > FAQ         │  1. **Hatch** - Create your agent              │
│                │  2. **Configure DNA** - Set personality        │
│                │  3. **Set Sonar** - Choose activity level      │
│                │  4. **Install Fins** - Add capabilities        │
│                │  5. **Fund & Activate** - Deposit SOL          │
└────────────────┴────────────────────────────────────────────────┘
```

### 3.4 Navigation Updates

#### Update `LaunchpadLayout.tsx`
```typescript
// Add to desktop navigation (after Trading Agents button)
<Link to="/opentuna">
  <Button 
    size="sm" 
    className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-lg h-9 px-3 text-sm font-medium"
  >
    <Fish className="h-4 w-4 mr-1.5" />
    OpenTuna
  </Button>
</Link>

// Add to mobile navigation (same styling)
```

#### Update `AppHeader.tsx`
```typescript
// Add OpenTuna link to both desktop and mobile menus
```

#### Update `App.tsx`
```typescript
// Add lazy import
const OpenTunaPage = lazy(() => import("./pages/OpenTunaPage"));

// Add route
<Route path="/opentuna" element={<OpenTunaPage />} />
```

### 3.5 Styling (Add to `index.css`)

```css
/* OpenTuna Theme */
.opentuna-card {
  @apply bg-card/50 border border-cyan-500/20 hover:border-cyan-500/40 
         transition-all duration-200 rounded-xl;
}

.opentuna-gradient-text {
  @apply bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent;
}

.opentuna-glow {
  box-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
}

.opentuna-button {
  @apply bg-gradient-to-r from-cyan-600 to-teal-600 
         hover:from-cyan-700 hover:to-teal-700 
         text-white font-medium;
}
```

---

## Part 4: Domain Configuration

### 4.1 DNS Setup for OS.tuna.fun
- Add A record: `os` → `185.158.133.1`
- Add TXT record: `_lovable` → verification value from Lovable settings

### 4.2 Lovable Domain Settings
- Add `os.tuna.fun` as custom domain
- Point to `/opentuna` route

---

## Part 5: Security Architecture

### 5.1 Vault (AES-256-GCM Encryption)

All agent private keys encrypted at rest using existing pattern:

```typescript
async function encryptWallet(privateKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(encryptionKey);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw", keyHash, { name: "AES-GCM" }, false, ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(privateKey)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}
```

### 5.2 Sandbox Execution

All `fin_bash` and `fin_browse` run in Docker containers:

```typescript
interface SandboxConfig {
  type: 'standard' | 'restricted' | 'privileged';
  maxCpuPercent: number;
  maxMemoryMb: number;
  maxDiskMb: number;
  maxExecutionMs: number;
  networkEnabled: boolean;
  allowedDomains: string[];
}
```

### 5.3 Fin Verification

Before listing in Fin Market:
- Automated static analysis
- Sandboxed test execution
- Manual review for premium fins

---

## Part 6: Implementation Timeline

### Phase 1: Database Foundation (Days 1-2)
- [ ] Create all 12 database tables via migration
- [ ] Set up RLS policies
- [ ] Enable pgvector extension
- [ ] Seed native fins

### Phase 2: Core Edge Functions (Days 3-6)
- [ ] `opentuna-agent-hatch` - Create agents
- [ ] `opentuna-dna-update` - DNA management
- [ ] `opentuna-fin-read` - File reading
- [ ] `opentuna-fin-write` - File writing
- [ ] `opentuna-fin-edit` - Surgical edits
- [ ] `opentuna-fin-bash` - Shell execution

### Phase 3: Sonar System (Days 7-9)
- [ ] `opentuna-sonar-ping` - Decision engine
- [ ] `opentuna-sonar-cron` - Scheduled triggers
- [ ] Sonar mode management

### Phase 4: Deep Memory (Days 10-11)
- [ ] `opentuna-memory-store` - Store with embeddings
- [ ] `opentuna-echo-locate` - Hybrid search
- [ ] Memory expiration cleanup

### Phase 5: Browser & Trading (Days 12-14)
- [ ] `opentuna-fin-browse` - Puppeteer integration
- [ ] `opentuna-fin-trade` - Jupiter + Jito integration
- [ ] Position management

### Phase 6: SchoolPay Economy (Days 15-17)
- [ ] `opentuna-school-pay` - x402 payment flow
- [ ] `opentuna-current-verify` - On-chain verification
- [ ] Transaction history

### Phase 7: Fin Forge (Days 18-19)
- [ ] `opentuna-fin-forge` - Pattern detection
- [ ] Auto-generation of fins
- [ ] Hot-reload system

### Phase 8: Multi-Agent Teams (Days 20-21)
- [ ] School creation
- [ ] Task delegation
- [ ] Team coordination

### Phase 9: Frontend (Days 22-26)
- [ ] OpenTunaPage.tsx (main container)
- [ ] All 8 tab components
- [ ] Navigation integration
- [ ] Styling and polish

### Phase 10: Documentation & Testing (Days 27-28)
- [ ] In-app documentation
- [ ] SDK examples
- [ ] End-to-end testing
- [ ] Security audit

---

## Part 7: Comparison Summary

| Feature | OpenClaw | OpenTuna |
|---------|----------|----------|
| **Hosting** | Self-hosted (dangerous) | Managed Cloud |
| **Key Storage** | Plaintext in .md files | AES-256-GCM Vault |
| **File Operations** | read/write/edit | ✓ fin_read/fin_write/fin_edit |
| **Shell Access** | Full local access | Docker sandboxed |
| **Browser** | navigate/click/type | ✓ fin_browse (Puppeteer) |
| **Self-Extension** | Write own code | ✓ Fin Forge |
| **Memory** | Hybrid vector+BM25 | ✓ Deep Memory (pgvector) |
| **Payments** | USDC multi-chain | SOL native (x402) |
| **Trading** | Manual/limited | Jupiter V6 + Jito |
| **Skill Market** | MoltHub (26% malware) | Verified Fin Market |
| **Multi-Agent** | Team coordination | ✓ Schools |
| **Setup Time** | Hours (DevOps) | 60 seconds |

---

## Summary

**OpenTuna** is a complete Autonomous Agent Operating System with:

- **12 new database tables** for agents, DNA, sonar, memory, fins, economy, teams
- **18 new edge functions** for all primitives and systems
- **1 main page** with 8 tabs (no page navigation needed)
- **Full OpenClaw parity** plus trading and Solana-native payments
- **28-day implementation timeline**

The system is accessible at `/opentuna` and via the `OS.tuna.fun` domain, with an "OpenTuna" button in the main navigation.

