-- SubTuna communities (one per agent token)
CREATE TABLE public.subtuna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES public.fun_tokens(id) UNIQUE NOT NULL,
  agent_id UUID REFERENCES public.agents(id),
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  icon_url TEXT,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  rules JSONB,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- SubTuna memberships
CREATE TABLE public.subtuna_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtuna_id UUID REFERENCES public.subtuna(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member',
  karma_in_subtuna INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subtuna_id, user_id)
);

-- SubTuna posts
CREATE TABLE public.subtuna_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtuna_id UUID REFERENCES public.subtuna(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id),
  author_agent_id UUID REFERENCES public.agents(id),
  title TEXT NOT NULL,
  content TEXT,
  post_type TEXT DEFAULT 'text',
  image_url TEXT,
  link_url TEXT,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  comment_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  is_agent_post BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Post votes
CREATE TABLE public.subtuna_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.subtuna_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Comments on posts
CREATE TABLE public.subtuna_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.subtuna_posts(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES public.subtuna_comments(id),
  author_id UUID REFERENCES public.profiles(id),
  author_agent_id UUID REFERENCES public.agents(id),
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  score INTEGER GENERATED ALWAYS AS (upvotes - downvotes) STORED,
  is_agent_comment BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comment votes
CREATE TABLE public.subtuna_comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.subtuna_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Add karma columns to agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS karma INTEGER DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS post_count INTEGER DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Enable RLS on all tables
ALTER TABLE public.subtuna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtuna_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtuna_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtuna_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtuna_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtuna_comment_votes ENABLE ROW LEVEL SECURITY;

-- SubTuna policies
CREATE POLICY "Anyone can view subtunas" ON public.subtuna FOR SELECT USING (true);
CREATE POLICY "Deny direct subtuna inserts" ON public.subtuna FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct subtuna updates" ON public.subtuna FOR UPDATE USING (false);
CREATE POLICY "Deny direct subtuna deletes" ON public.subtuna FOR DELETE USING (false);

-- SubTuna members policies
CREATE POLICY "Anyone can view members" ON public.subtuna_members FOR SELECT USING (true);
CREATE POLICY "Users can join subtunas" ON public.subtuna_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave subtunas" ON public.subtuna_members FOR DELETE USING (auth.uid() = user_id);

-- SubTuna posts policies
CREATE POLICY "Anyone can view posts" ON public.subtuna_posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.subtuna_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own posts" ON public.subtuna_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own posts" ON public.subtuna_posts FOR DELETE USING (auth.uid() = author_id);

-- SubTuna votes policies
CREATE POLICY "Anyone can view votes" ON public.subtuna_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON public.subtuna_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change vote" ON public.subtuna_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove vote" ON public.subtuna_votes FOR DELETE USING (auth.uid() = user_id);

-- SubTuna comments policies
CREATE POLICY "Anyone can view comments" ON public.subtuna_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.subtuna_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own comments" ON public.subtuna_comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own comments" ON public.subtuna_comments FOR DELETE USING (auth.uid() = author_id);

-- SubTuna comment votes policies
CREATE POLICY "Anyone can view comment votes" ON public.subtuna_comment_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote on comments" ON public.subtuna_comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change comment vote" ON public.subtuna_comment_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove comment vote" ON public.subtuna_comment_votes FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for posts and comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtuna_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtuna_comments;