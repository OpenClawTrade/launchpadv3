-- Phase E: Add indexes to prevent database timeouts on sorting queries

-- Indexes for subtuna_posts table
CREATE INDEX IF NOT EXISTS idx_subtuna_posts_created_at_desc 
ON public.subtuna_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subtuna_posts_guest_upvotes_created 
ON public.subtuna_posts (guest_upvotes DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subtuna_posts_comment_count_created 
ON public.subtuna_posts (comment_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subtuna_posts_subtuna_id_created 
ON public.subtuna_posts (subtuna_id, created_at DESC);

-- Indexes for agents table (for top agents sidebar)
CREATE INDEX IF NOT EXISTS idx_agents_status_fees 
ON public.agents (status, total_fees_earned_sol DESC);

-- Index for subtuna table
CREATE INDEX IF NOT EXISTS idx_subtuna_created_at_desc 
ON public.subtuna (created_at DESC);

-- Index for agent_tokens table
CREATE INDEX IF NOT EXISTS idx_agent_tokens_created_at_desc 
ON public.agent_tokens (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_tokens_agent_id 
ON public.agent_tokens (agent_id);

-- Index for fun_tokens (commonly queried by created_at)
CREATE INDEX IF NOT EXISTS idx_fun_tokens_created_at_desc 
ON public.fun_tokens (created_at DESC);