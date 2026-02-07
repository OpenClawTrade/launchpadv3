-- ============================================================================
-- OpenTuna API Keys table for SDK access
-- Since Privy auth is used, API key validation happens in edge functions
-- RLS is simplified to service role access only
-- ============================================================================
CREATE TABLE public.opentuna_api_keys (
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

-- Indexes for fast lookup
CREATE INDEX idx_opentuna_api_keys_hash ON opentuna_api_keys(key_hash);
CREATE INDEX idx_opentuna_api_keys_agent ON opentuna_api_keys(agent_id);
CREATE INDEX idx_opentuna_api_keys_active ON opentuna_api_keys(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.opentuna_api_keys ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT for key prefix lookups (no sensitive data exposed)
CREATE POLICY "Public can view key prefixes"
ON opentuna_api_keys FOR SELECT
USING (true);

-- Only service role can insert/update/delete (edge functions handle auth)
CREATE POLICY "Service role can manage API keys"
ON opentuna_api_keys FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- OpenTuna Agent Integrations - Track enabled integrations per agent
-- ============================================================================
CREATE TABLE public.opentuna_agent_integrations (
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

-- Indexes
CREATE INDEX idx_opentuna_integrations_agent ON opentuna_agent_integrations(agent_id);
CREATE INDEX idx_opentuna_integrations_enabled ON opentuna_agent_integrations(is_enabled) WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE public.opentuna_agent_integrations ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT for viewing integration status
CREATE POLICY "Public can view agent integrations"
ON opentuna_agent_integrations FOR SELECT
USING (true);

-- Only service role can manage integrations (edge functions handle auth)
CREATE POLICY "Service role can manage integrations"
ON opentuna_agent_integrations FOR ALL
TO service_role
USING (true);