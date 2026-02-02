-- Guest votes table for anonymous visitors (1 vote per IP per post)
CREATE TABLE public.subtuna_guest_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES subtuna_posts(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL, -- SHA256 hash of IP for privacy
  vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, ip_hash) -- One vote per IP per post
);

-- Index for fast lookups
CREATE INDEX idx_subtuna_guest_votes_post ON subtuna_guest_votes(post_id);
CREATE INDEX idx_subtuna_guest_votes_ip ON subtuna_guest_votes(ip_hash);

-- Enable RLS
ALTER TABLE public.subtuna_guest_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view aggregate votes (but not individual IPs)
CREATE POLICY "Anyone can view guest votes" 
ON public.subtuna_guest_votes 
FOR SELECT 
USING (true);

-- No direct inserts - must go through edge function
CREATE POLICY "Deny direct guest vote inserts" 
ON public.subtuna_guest_votes 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "Deny direct guest vote updates" 
ON public.subtuna_guest_votes 
FOR UPDATE 
USING (false);

CREATE POLICY "Deny direct guest vote deletes" 
ON public.subtuna_guest_votes 
FOR DELETE 
USING (false);

-- Add guest vote counts to posts (cached for performance)
ALTER TABLE public.subtuna_posts ADD COLUMN IF NOT EXISTS guest_upvotes INTEGER DEFAULT 0;
ALTER TABLE public.subtuna_posts ADD COLUMN IF NOT EXISTS guest_downvotes INTEGER DEFAULT 0;

-- Function to update guest vote counts on posts
CREATE OR REPLACE FUNCTION update_guest_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 1 THEN
      UPDATE subtuna_posts SET guest_upvotes = guest_upvotes + 1 WHERE id = NEW.post_id;
    ELSE
      UPDATE subtuna_posts SET guest_downvotes = guest_downvotes + 1 WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 1 THEN
      UPDATE subtuna_posts SET guest_upvotes = GREATEST(0, guest_upvotes - 1) WHERE id = OLD.post_id;
    ELSE
      UPDATE subtuna_posts SET guest_downvotes = GREATEST(0, guest_downvotes - 1) WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote_type != NEW.vote_type THEN
    -- Switching vote direction
    IF NEW.vote_type = 1 THEN
      UPDATE subtuna_posts SET guest_upvotes = guest_upvotes + 1, guest_downvotes = GREATEST(0, guest_downvotes - 1) WHERE id = NEW.post_id;
    ELSE
      UPDATE subtuna_posts SET guest_downvotes = guest_downvotes + 1, guest_upvotes = GREATEST(0, guest_upvotes - 1) WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for guest vote counts
CREATE TRIGGER update_guest_votes_trigger
AFTER INSERT OR UPDATE OR DELETE ON subtuna_guest_votes
FOR EACH ROW
EXECUTE FUNCTION update_guest_vote_counts();