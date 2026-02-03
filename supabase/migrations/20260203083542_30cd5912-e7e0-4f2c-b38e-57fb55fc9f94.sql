-- Colosseum Hackathon tracking tables

-- Track registrations and API credentials
CREATE TABLE colosseum_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'tuna-agent-sdk',
  api_key_encrypted TEXT NOT NULL,
  claim_code TEXT,
  registered_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track all Colosseum API activity
CREATE TABLE colosseum_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL, -- 'register', 'heartbeat', 'forum_post', 'forum_comment', 'submit', 'vote'
  payload JSONB,
  response JSONB,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Track forum posts we've made
CREATE TABLE colosseum_forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colosseum_post_id TEXT,
  title TEXT,
  body TEXT,
  post_type TEXT NOT NULL DEFAULT 'progress', -- 'progress', 'engagement', 'announcement', 'demo'
  tags TEXT[] DEFAULT '{}',
  upvotes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);

-- Track comments on other projects
CREATE TABLE colosseum_forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colosseum_comment_id TEXT,
  target_post_id TEXT NOT NULL,
  target_project_name TEXT,
  body TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE colosseum_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE colosseum_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE colosseum_forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE colosseum_forum_comments ENABLE ROW LEVEL SECURITY;

-- Admins can view registrations
CREATE POLICY "Admins can view colosseum registrations" ON colosseum_registrations
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role only for mutations (edge functions)
CREATE POLICY "Deny direct colosseum_registrations inserts" ON colosseum_registrations
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct colosseum_registrations updates" ON colosseum_registrations
  FOR UPDATE USING (false);
CREATE POLICY "Deny direct colosseum_registrations deletes" ON colosseum_registrations
  FOR DELETE USING (false);

-- Activity is admin viewable only
CREATE POLICY "Admins can view colosseum activity" ON colosseum_activity
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Deny direct colosseum_activity inserts" ON colosseum_activity
  FOR INSERT WITH CHECK (false);

-- Forum posts are public to view
CREATE POLICY "Anyone can view colosseum forum posts" ON colosseum_forum_posts
  FOR SELECT USING (true);
CREATE POLICY "Deny direct colosseum_forum_posts inserts" ON colosseum_forum_posts
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct colosseum_forum_posts updates" ON colosseum_forum_posts
  FOR UPDATE USING (false);

-- Comments are public to view
CREATE POLICY "Anyone can view colosseum forum comments" ON colosseum_forum_comments
  FOR SELECT USING (true);
CREATE POLICY "Deny direct colosseum_forum_comments inserts" ON colosseum_forum_comments
  FOR INSERT WITH CHECK (false);