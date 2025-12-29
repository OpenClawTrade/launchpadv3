-- Create user_mutes table for muting users
CREATE TABLE public.user_mutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  muted_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_user_id)
);

-- Create user_blocks table for blocking users
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  blocked_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, blocked_user_id)
);

-- Create reports table for reporting posts/users
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID,
  reported_post_id UUID,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_mutes
CREATE POLICY "Users can view their own mutes"
ON public.user_mutes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can mute others"
ON public.user_mutes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmute others"
ON public.user_mutes FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for user_blocks
CREATE POLICY "Users can view their own blocks"
ON public.user_blocks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can block others"
ON public.user_blocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unblock others"
ON public.user_blocks FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for reports
CREATE POLICY "Users can view their own reports"
ON public.reports FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Authenticated users can create reports"
ON public.reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Create indexes for performance
CREATE INDEX idx_user_mutes_user_id ON public.user_mutes(user_id);
CREATE INDEX idx_user_mutes_muted_user_id ON public.user_mutes(muted_user_id);
CREATE INDEX idx_user_blocks_user_id ON public.user_blocks(user_id);
CREATE INDEX idx_user_blocks_blocked_user_id ON public.user_blocks(blocked_user_id);
CREATE INDEX idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX idx_reports_status ON public.reports(status);