-- Add x_post_id column to subtuna_posts to track crossposted tweets
ALTER TABLE public.subtuna_posts 
ADD COLUMN IF NOT EXISTS x_post_id TEXT;