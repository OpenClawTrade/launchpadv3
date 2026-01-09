-- Add username change tracking column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMP WITH TIME ZONE;