-- Create ip_bans table for banned IP addresses
CREATE TABLE public.ip_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  banned_by UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(ip_address)
);

-- Enable RLS
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;

-- Admins can manage IP bans
CREATE POLICY "Admins can manage ip bans"
ON public.ip_bans
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Anyone can check if an IP is banned (for auth blocking)
CREATE POLICY "Anyone can view ip bans"
ON public.ip_bans
FOR SELECT
USING (true);

-- Create user_ip_logs table to track user IPs
CREATE TABLE public.user_ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER DEFAULT 1,
  UNIQUE(user_id, ip_address)
);

-- Enable RLS
ALTER TABLE public.user_ip_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all IP logs
CREATE POLICY "Admins can view ip logs"
ON public.user_ip_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can manage IP logs
CREATE POLICY "System can manage ip logs"
ON public.user_ip_logs
FOR ALL
USING (true);

-- Add IP address column to user_bans for quick reference
ALTER TABLE public.user_bans ADD COLUMN IF NOT EXISTS associated_ips TEXT[];

-- Create function to check if IP is banned
CREATE OR REPLACE FUNCTION public.is_ip_banned(_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ip_bans
    WHERE ip_address = _ip_address
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Create function to get user IPs for banning
CREATE OR REPLACE FUNCTION public.get_user_ips(_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(ip_address)
  FROM public.user_ip_logs
  WHERE user_id = _user_id
$$;