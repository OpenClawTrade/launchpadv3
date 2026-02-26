
CREATE TABLE public.punch_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  ip_address TEXT,
  fingerprint TEXT,
  total_launches INTEGER NOT NULL DEFAULT 0,
  total_punches INTEGER NOT NULL DEFAULT 0,
  total_fees_earned_sol NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wallet_address)
);

-- Allow public read/write since no auth
ALTER TABLE public.punch_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.punch_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON public.punch_users FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON public.punch_users FOR UPDATE USING (true);

-- RPC to upsert a punch user
CREATE OR REPLACE FUNCTION public.upsert_punch_user(
  p_wallet_address TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.punch_users (wallet_address, ip_address, fingerprint)
  VALUES (p_wallet_address, p_ip_address, p_fingerprint)
  ON CONFLICT (wallet_address) DO UPDATE SET
    ip_address = COALESCE(EXCLUDED.ip_address, punch_users.ip_address),
    fingerprint = COALESCE(EXCLUDED.fingerprint, punch_users.fingerprint),
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RPC to increment launch count after successful launch
CREATE OR REPLACE FUNCTION public.increment_punch_user_launches(p_wallet_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.punch_users
  SET total_launches = total_launches + 1, updated_at = now()
  WHERE wallet_address = p_wallet_address;
END;
$$;
