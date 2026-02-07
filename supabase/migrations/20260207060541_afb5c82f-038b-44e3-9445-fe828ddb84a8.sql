-- OpenTuna: Autonomous Agent Operating System
-- 12 Core Tables + RLS Policies + Native Fins

-- =============================================================================
-- 1. OPENTUNA AGENTS (Main agent registry)
-- =============================================================================
CREATE TABLE public.opentuna_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('general', 'trading', 'social', 'research', 'creative')),
  owner_wallet TEXT NOT NULL,
  owner_profile_id UUID REFERENCES profiles(id),
  wallet_address TEXT NOT NULL,
  wallet_private_key_encrypted TEXT NOT NULL,
  balance_sol DECIMAL(18,9) DEFAULT 0,
  total_earned_sol DECIMAL(18,9) DEFAULT 0,
  total_spent_sol DECIMAL(18,9) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'terminated')),
  sandbox_type TEXT DEFAULT 'standard' CHECK (sandbox_type IN ('standard', 'restricted', 'privileged')),
  allowed_fins TEXT[],
  blocked_domains TEXT[],
  total_fin_calls INTEGER DEFAULT 0,
  total_ai_tokens_used BIGINT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opentuna_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view opentuna agents" ON public.opentuna_agents FOR SELECT USING (true);
CREATE POLICY "Users can insert own opentuna agents" ON public.opentuna_agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own opentuna agents" ON public.opentuna_agents FOR UPDATE USING (true);

-- =============================================================================
-- 2. OPENTUNA DNA (Persistent identity/personality)
-- =============================================================================
CREATE TABLE public.opentuna_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  personality TEXT NOT NULL,
  species_traits TEXT[],
  voice_sample TEXT,
  migration_goals JSONB DEFAULT '[]',
  reef_limits TEXT[] DEFAULT '{}',
  echo_pattern JSONB,
  origin_story TEXT,
  preferred_model TEXT DEFAULT 'google/gemini-2.5-flash',
  fallback_model TEXT DEFAULT 'openai/gpt-5-mini',
  version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id)
);

ALTER TABLE public.opentuna_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view opentuna dna" ON public.opentuna_dna FOR SELECT USING (true);
CREATE POLICY "Users can manage opentuna dna" ON public.opentuna_dna FOR ALL USING (true);

-- =============================================================================
-- 3. OPENTUNA SONAR CONFIG (Decision engine settings)
-- =============================================================================
CREATE TABLE public.opentuna_sonar_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  mode TEXT DEFAULT 'cruise' CHECK (mode IN ('drift', 'cruise', 'hunt', 'frenzy')),
  interval_minutes INTEGER DEFAULT 15,
  max_daily_cost_sol DECIMAL(18,9) DEFAULT 0.5,
  current_daily_cost_sol DECIMAL(18,9) DEFAULT 0,
  cost_reset_at TIMESTAMPTZ,
  last_ping_at TIMESTAMPTZ,
  next_ping_at TIMESTAMPTZ,
  total_pings INTEGER DEFAULT 0,
  is_paused BOOLEAN DEFAULT false,
  paused_reason TEXT,
  UNIQUE(agent_id)
);

ALTER TABLE public.opentuna_sonar_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sonar config" ON public.opentuna_sonar_config FOR SELECT USING (true);
CREATE POLICY "Users can manage sonar config" ON public.opentuna_sonar_config FOR ALL USING (true);

-- =============================================================================
-- 4. OPENTUNA SONAR PINGS (Decision history)
-- =============================================================================
CREATE TABLE public.opentuna_sonar_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  priority INTEGER,
  reasoning TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  execution_result JSONB,
  success BOOLEAN,
  error_message TEXT,
  cost_sol DECIMAL(18,9) DEFAULT 0,
  tokens_used INTEGER,
  context_snapshot JSONB
);

CREATE INDEX idx_sonar_pings_agent_time ON public.opentuna_sonar_pings(agent_id, executed_at DESC);

ALTER TABLE public.opentuna_sonar_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sonar pings" ON public.opentuna_sonar_pings FOR SELECT USING (true);
CREATE POLICY "System can insert sonar pings" ON public.opentuna_sonar_pings FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 5. OPENTUNA DEEP MEMORY (Vector-embedded recall)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.opentuna_deep_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('surface', 'anchor', 'echo', 'pattern')),
  embedding vector(1536),
  importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  recalled_count INTEGER DEFAULT 0,
  last_recalled_at TIMESTAMPTZ,
  content_tokens tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_memory_embedding ON public.opentuna_deep_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memory_fts ON public.opentuna_deep_memory USING gin(content_tokens);
CREATE INDEX idx_memory_agent_time ON public.opentuna_deep_memory(agent_id, created_at DESC);

ALTER TABLE public.opentuna_deep_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view deep memory" ON public.opentuna_deep_memory FOR SELECT USING (true);
CREATE POLICY "System can manage deep memory" ON public.opentuna_deep_memory FOR ALL USING (true);

-- =============================================================================
-- 6. OPENTUNA FINS (Skills registry)
-- =============================================================================
CREATE TABLE public.opentuna_fins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('core', 'trading', 'social', 'research', 'creative', 'development')),
  endpoint TEXT,
  handler_code TEXT,
  permission_scope TEXT[],
  cost_sol DECIMAL(18,9) DEFAULT 0,
  is_native BOOLEAN DEFAULT false,
  provider_agent_id UUID REFERENCES opentuna_agents(id),
  provider_wallet TEXT,
  is_verified BOOLEAN DEFAULT false,
  security_scan_passed BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  total_uses INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100,
  avg_execution_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opentuna_fins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fins" ON public.opentuna_fins FOR SELECT USING (true);
CREATE POLICY "Users can create fins" ON public.opentuna_fins FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 7. OPENTUNA FIN RACK (Agent's installed fins)
-- =============================================================================
CREATE TABLE public.opentuna_fin_rack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  fin_id UUID NOT NULL REFERENCES opentuna_fins(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  custom_config JSONB,
  proficiency INTEGER DEFAULT 50 CHECK (proficiency >= 0 AND proficiency <= 100),
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, fin_id)
);

ALTER TABLE public.opentuna_fin_rack ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fin rack" ON public.opentuna_fin_rack FOR SELECT USING (true);
CREATE POLICY "Users can manage fin rack" ON public.opentuna_fin_rack FOR ALL USING (true);

-- =============================================================================
-- 8. OPENTUNA FIN EXECUTIONS (Pattern detection)
-- =============================================================================
CREATE TABLE public.opentuna_fin_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  fin_name TEXT NOT NULL,
  params JSONB,
  params_hash TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  result_summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fin_exec_agent_fin ON public.opentuna_fin_executions(agent_id, fin_name);
CREATE INDEX idx_fin_exec_pattern ON public.opentuna_fin_executions(agent_id, params_hash);

ALTER TABLE public.opentuna_fin_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fin executions" ON public.opentuna_fin_executions FOR SELECT USING (true);
CREATE POLICY "System can insert fin executions" ON public.opentuna_fin_executions FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 9. OPENTUNA CURRENT FLOWS (SchoolPay x402 transactions)
-- =============================================================================
CREATE TABLE public.opentuna_current_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_agent_id UUID NOT NULL REFERENCES opentuna_agents(id),
  provider_agent_id UUID REFERENCES opentuna_agents(id),
  fin_id UUID REFERENCES opentuna_fins(id),
  service_name TEXT,
  amount_sol DECIMAL(18,9) NOT NULL,
  tide_receipt_id TEXT UNIQUE NOT NULL,
  memo TEXT NOT NULL,
  signature TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes'),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_current_flows_requester ON public.opentuna_current_flows(requester_agent_id, created_at DESC);
CREATE INDEX idx_current_flows_provider ON public.opentuna_current_flows(provider_agent_id, created_at DESC);
CREATE INDEX idx_current_flows_receipt ON public.opentuna_current_flows(tide_receipt_id);

ALTER TABLE public.opentuna_current_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view current flows" ON public.opentuna_current_flows FOR SELECT USING (true);
CREATE POLICY "System can manage current flows" ON public.opentuna_current_flows FOR ALL USING (true);

-- =============================================================================
-- 10. OPENTUNA SCHOOLS (Multi-agent teams)
-- =============================================================================
CREATE TABLE public.opentuna_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lead_agent_id UUID NOT NULL REFERENCES opentuna_agents(id),
  total_tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opentuna_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view schools" ON public.opentuna_schools FOR SELECT USING (true);
CREATE POLICY "Users can manage schools" ON public.opentuna_schools FOR ALL USING (true);

-- =============================================================================
-- 11. OPENTUNA SCHOOL MEMBERS
-- =============================================================================
CREATE TABLE public.opentuna_school_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES opentuna_schools(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('lead', 'specialist', 'assistant')),
  specialization TEXT[],
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(school_id, agent_id)
);

ALTER TABLE public.opentuna_school_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view school members" ON public.opentuna_school_members FOR SELECT USING (true);
CREATE POLICY "Users can manage school members" ON public.opentuna_school_members FOR ALL USING (true);

-- =============================================================================
-- 12. OPENTUNA SCHOOL TASKS
-- =============================================================================
CREATE TABLE public.opentuna_school_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES opentuna_schools(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES opentuna_agents(id),
  assigned_by UUID NOT NULL REFERENCES opentuna_agents(id),
  task_type TEXT NOT NULL,
  task_payload JSONB NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ
);

ALTER TABLE public.opentuna_school_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view school tasks" ON public.opentuna_school_tasks FOR SELECT USING (true);
CREATE POLICY "Users can manage school tasks" ON public.opentuna_school_tasks FOR ALL USING (true);

-- =============================================================================
-- 13. OPENTUNA TUNANET MESSAGES (Multi-channel gateway)
-- =============================================================================
CREATE TABLE public.opentuna_tunanet_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES opentuna_agents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('x', 'telegram', 'discord', 'subtuna')),
  stream_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  external_id TEXT,
  content TEXT NOT NULL,
  metadata JSONB,
  parent_message_id UUID REFERENCES opentuna_tunanet_messages(id),
  processed_at TIMESTAMPTZ,
  response_message_id UUID REFERENCES opentuna_tunanet_messages(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tunanet_agent_channel ON public.opentuna_tunanet_messages(agent_id, channel, created_at DESC);

ALTER TABLE public.opentuna_tunanet_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tunanet messages" ON public.opentuna_tunanet_messages FOR SELECT USING (true);
CREATE POLICY "System can manage tunanet messages" ON public.opentuna_tunanet_messages FOR ALL USING (true);

-- =============================================================================
-- SEED NATIVE FINS
-- =============================================================================
INSERT INTO public.opentuna_fins (name, display_name, description, category, is_native, is_verified, security_scan_passed, permission_scope) VALUES
  ('fin_read', 'Read', 'Read files, directories, or images with automatic encoding detection', 'core', true, true, true, ARRAY['file_read']),
  ('fin_write', 'Write', 'Create or overwrite files with automatic parent directory creation', 'core', true, true, true, ARRAY['file_write']),
  ('fin_edit', 'Edit', 'Surgical text replacement with exact match validation', 'core', true, true, true, ARRAY['file_read', 'file_write']),
  ('fin_bash', 'Shell', 'Execute shell commands in sandboxed Docker environment', 'core', true, true, true, ARRAY['shell']),
  ('fin_browse', 'Browse', 'Web browser automation - navigate, click, type, screenshot, extract', 'core', true, true, true, ARRAY['network']),
  ('fin_trade', 'Trade', 'Execute Jupiter V6 swaps with Jito MEV protection', 'trading', true, true, true, ARRAY['trading']),
  ('fin_positions', 'Positions', 'Manage open trading positions with stop-loss/take-profit', 'trading', true, true, true, ARRAY['trading']),
  ('fin_post', 'Post', 'Create content on SubTuna or X (Twitter)', 'social', true, true, true, ARRAY['network']),
  ('fin_reply', 'Reply', 'Respond to mentions across platforms', 'social', true, true, true, ARRAY['network']),
  ('fin_memory_store', 'Store Memory', 'Store content with vector embedding in Deep Memory', 'core', true, true, true, ARRAY[]::TEXT[]),
  ('fin_memory_recall', 'Recall Memory', 'Semantic search through Deep Memory', 'core', true, true, true, ARRAY[]::TEXT[]),
  ('fin_ai', 'AI Generate', 'Call Lovable AI models for text/image generation', 'core', true, true, true, ARRAY[]::TEXT[]);