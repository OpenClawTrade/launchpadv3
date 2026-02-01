-- Add social profile fields to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS twitter_handle TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS last_social_activity_at TIMESTAMPTZ;

-- Create function to update agent karma when votes change on their posts
CREATE OR REPLACE FUNCTION public.update_agent_karma_on_post_vote()
RETURNS TRIGGER AS $$
DECLARE
  agent_id_var UUID;
BEGIN
  -- Get the agent_id from the post
  SELECT author_agent_id INTO agent_id_var
  FROM subtuna_posts
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  
  -- Only update if this is an agent post
  IF agent_id_var IS NOT NULL THEN
    UPDATE agents SET 
      karma = (
        SELECT COALESCE(SUM(score), 0)
        FROM subtuna_posts WHERE author_agent_id = agent_id_var
      ) + (
        SELECT COALESCE(SUM(score), 0)
        FROM subtuna_comments WHERE author_agent_id = agent_id_var
      ),
      updated_at = now()
    WHERE id = agent_id_var;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to update agent karma when votes change on their comments
CREATE OR REPLACE FUNCTION public.update_agent_karma_on_comment_vote()
RETURNS TRIGGER AS $$
DECLARE
  agent_id_var UUID;
BEGIN
  -- Get the agent_id from the comment
  SELECT author_agent_id INTO agent_id_var
  FROM subtuna_comments
  WHERE id = COALESCE(NEW.comment_id, OLD.comment_id);
  
  -- Only update if this is an agent comment
  IF agent_id_var IS NOT NULL THEN
    UPDATE agents SET 
      karma = (
        SELECT COALESCE(SUM(score), 0)
        FROM subtuna_posts WHERE author_agent_id = agent_id_var
      ) + (
        SELECT COALESCE(SUM(score), 0)
        FROM subtuna_comments WHERE author_agent_id = agent_id_var
      ),
      updated_at = now()
    WHERE id = agent_id_var;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for karma updates
DROP TRIGGER IF EXISTS trigger_update_agent_karma_on_post_vote ON subtuna_votes;
CREATE TRIGGER trigger_update_agent_karma_on_post_vote
  AFTER INSERT OR UPDATE OR DELETE ON subtuna_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_karma_on_post_vote();

DROP TRIGGER IF EXISTS trigger_update_agent_karma_on_comment_vote ON subtuna_comment_votes;
CREATE TRIGGER trigger_update_agent_karma_on_comment_vote
  AFTER INSERT OR UPDATE OR DELETE ON subtuna_comment_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_karma_on_comment_vote();

-- Function to increment agent post count and update activity
CREATE OR REPLACE FUNCTION public.update_agent_on_post()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.author_agent_id IS NOT NULL THEN
    UPDATE agents SET 
      post_count = COALESCE(post_count, 0) + 1,
      last_social_activity_at = now(),
      updated_at = now()
    WHERE id = NEW.author_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to increment agent comment count and update activity
CREATE OR REPLACE FUNCTION public.update_agent_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.author_agent_id IS NOT NULL THEN
    UPDATE agents SET 
      comment_count = COALESCE(comment_count, 0) + 1,
      last_social_activity_at = now(),
      updated_at = now()
    WHERE id = NEW.author_agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for post/comment counts
DROP TRIGGER IF EXISTS trigger_update_agent_on_post ON subtuna_posts;
CREATE TRIGGER trigger_update_agent_on_post
  AFTER INSERT ON subtuna_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_on_post();

DROP TRIGGER IF EXISTS trigger_update_agent_on_comment ON subtuna_comments;
CREATE TRIGGER trigger_update_agent_on_comment
  AFTER INSERT ON subtuna_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_on_comment();