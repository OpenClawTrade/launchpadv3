-- =====================================================
-- PHASE 1: Vote/Count Triggers for TunaBook
-- =====================================================

-- Function: Update post vote counts when votes change
CREATE OR REPLACE FUNCTION public.update_subtuna_post_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subtuna_posts
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END,
      score = upvotes - downvotes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE -1 END
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.subtuna_posts
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END - CASE WHEN OLD.vote_type = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END - CASE WHEN OLD.vote_type = -1 THEN 1 ELSE 0 END
    WHERE id = NEW.post_id;
    UPDATE public.subtuna_posts SET score = upvotes - downvotes WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.subtuna_posts
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote_type = -1 THEN 1 ELSE 0 END
    WHERE id = OLD.post_id;
    UPDATE public.subtuna_posts SET score = upvotes - downvotes WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for post votes
DROP TRIGGER IF EXISTS trigger_update_post_vote_counts ON public.subtuna_votes;
CREATE TRIGGER trigger_update_post_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON public.subtuna_votes
FOR EACH ROW EXECUTE FUNCTION public.update_subtuna_post_vote_counts();

-- Function: Update comment vote counts
CREATE OR REPLACE FUNCTION public.update_subtuna_comment_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subtuna_comments
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END,
      score = upvotes - downvotes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE -1 END
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.subtuna_comments
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 1 THEN 1 ELSE 0 END - CASE WHEN OLD.vote_type = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = -1 THEN 1 ELSE 0 END - CASE WHEN OLD.vote_type = -1 THEN 1 ELSE 0 END
    WHERE id = NEW.comment_id;
    UPDATE public.subtuna_comments SET score = upvotes - downvotes WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.subtuna_comments
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type = 1 THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote_type = -1 THEN 1 ELSE 0 END
    WHERE id = OLD.comment_id;
    UPDATE public.subtuna_comments SET score = upvotes - downvotes WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for comment votes
DROP TRIGGER IF EXISTS trigger_update_comment_vote_counts ON public.subtuna_comment_votes;
CREATE TRIGGER trigger_update_comment_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON public.subtuna_comment_votes
FOR EACH ROW EXECUTE FUNCTION public.update_subtuna_comment_vote_counts();

-- Function: Update post comment count
CREATE OR REPLACE FUNCTION public.update_subtuna_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subtuna_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.subtuna_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for comment count
DROP TRIGGER IF EXISTS trigger_update_post_comment_count ON public.subtuna_comments;
CREATE TRIGGER trigger_update_post_comment_count
AFTER INSERT OR DELETE ON public.subtuna_comments
FOR EACH ROW EXECUTE FUNCTION public.update_subtuna_post_comment_count();

-- Function: Update subtuna post count
CREATE OR REPLACE FUNCTION public.update_subtuna_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subtuna SET post_count = post_count + 1 WHERE id = NEW.subtuna_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.subtuna SET post_count = GREATEST(0, post_count - 1) WHERE id = OLD.subtuna_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for subtuna post count
DROP TRIGGER IF EXISTS trigger_update_subtuna_post_count ON public.subtuna_posts;
CREATE TRIGGER trigger_update_subtuna_post_count
AFTER INSERT OR DELETE ON public.subtuna_posts
FOR EACH ROW EXECUTE FUNCTION public.update_subtuna_counts();

-- Function: Update subtuna member count
CREATE OR REPLACE FUNCTION public.update_subtuna_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subtuna SET member_count = member_count + 1 WHERE id = NEW.subtuna_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.subtuna SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.subtuna_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for member count
DROP TRIGGER IF EXISTS trigger_update_subtuna_member_count ON public.subtuna_members;
CREATE TRIGGER trigger_update_subtuna_member_count
AFTER INSERT OR DELETE ON public.subtuna_members
FOR EACH ROW EXECUTE FUNCTION public.update_subtuna_member_count();

-- =====================================================
-- PHASE 2: Schema additions for moderation
-- =====================================================

-- Add is_locked column to posts
ALTER TABLE public.subtuna_posts ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Add is_moderator column to members
ALTER TABLE public.subtuna_members ADD COLUMN IF NOT EXISTS is_moderator BOOLEAN DEFAULT false;

-- Create reports table
CREATE TABLE IF NOT EXISTS public.subtuna_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  moderator_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS on reports
ALTER TABLE public.subtuna_reports ENABLE ROW LEVEL SECURITY;

-- RLS: Users can create reports
CREATE POLICY "Users can create reports" ON public.subtuna_reports
FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- RLS: Users can view their own reports
CREATE POLICY "Users can view own reports" ON public.subtuna_reports
FOR SELECT USING (auth.uid() = reporter_id);

-- RLS: Admins can view all reports
CREATE POLICY "Admins can view all reports" ON public.subtuna_reports
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Admins can update reports
CREATE POLICY "Admins can update reports" ON public.subtuna_reports
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- PHASE 3: Admin RPC functions (SECURITY DEFINER)
-- =====================================================

-- Admin: Delete post
CREATE OR REPLACE FUNCTION public.admin_delete_post(_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  DELETE FROM public.subtuna_posts WHERE id = _post_id;
  RETURN FOUND;
END;
$$;

-- Admin: Delete comment
CREATE OR REPLACE FUNCTION public.admin_delete_comment(_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  DELETE FROM public.subtuna_comments WHERE id = _comment_id;
  RETURN FOUND;
END;
$$;

-- Admin: Pin/unpin post
CREATE OR REPLACE FUNCTION public.admin_toggle_pin_post(_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_value BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  UPDATE public.subtuna_posts 
  SET is_pinned = NOT is_pinned 
  WHERE id = _post_id
  RETURNING is_pinned INTO new_value;
  
  RETURN new_value;
END;
$$;

-- Admin: Lock/unlock post
CREATE OR REPLACE FUNCTION public.admin_toggle_lock_post(_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_value BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  UPDATE public.subtuna_posts 
  SET is_locked = NOT is_locked 
  WHERE id = _post_id
  RETURNING is_locked INTO new_value;
  
  RETURN new_value;
END;
$$;

-- Admin: Resolve report
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  _report_id UUID,
  _status TEXT,
  _notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  UPDATE public.subtuna_reports 
  SET 
    status = _status,
    moderator_notes = COALESCE(_notes, moderator_notes),
    reviewed_by = auth.uid(),
    resolved_at = now()
  WHERE id = _report_id;
  
  RETURN FOUND;
END;
$$;

-- Admin: Assign moderator
CREATE OR REPLACE FUNCTION public.admin_set_moderator(
  _subtuna_id UUID,
  _user_id UUID,
  _is_mod BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  UPDATE public.subtuna_members 
  SET is_moderator = _is_mod
  WHERE subtuna_id = _subtuna_id AND user_id = _user_id;
  
  RETURN FOUND;
END;
$$;