-- Create SECURITY DEFINER functions for vanity keypair operations

-- Insert a new vanity keypair
CREATE OR REPLACE FUNCTION public.backend_insert_vanity_keypair(
  p_suffix TEXT,
  p_public_key TEXT,
  p_secret_key_encrypted TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.vanity_keypairs (suffix, public_key, secret_key_encrypted, status)
  VALUES (p_suffix, p_public_key, p_secret_key_encrypted, 'available')
  RETURNING id INTO v_id;
  
  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RETURN NULL;
END;
$$;

-- Get vanity stats (count by status)
CREATE OR REPLACE FUNCTION public.backend_get_vanity_stats(p_suffix TEXT DEFAULT NULL)
RETURNS TABLE(
  total BIGINT,
  available BIGINT,
  reserved BIGINT,
  used BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE status = 'available')::BIGINT as available,
    COUNT(*) FILTER (WHERE status = 'reserved')::BIGINT as reserved,
    COUNT(*) FILTER (WHERE status = 'used')::BIGINT as used
  FROM public.vanity_keypairs
  WHERE (p_suffix IS NULL OR suffix = lower(p_suffix));
END;
$$;

-- Get suffix breakdown
CREATE OR REPLACE FUNCTION public.backend_get_vanity_suffixes()
RETURNS TABLE(
  suffix TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT vk.suffix, COUNT(*)::BIGINT as count
  FROM public.vanity_keypairs vk
  GROUP BY vk.suffix
  ORDER BY count DESC;
END;
$$;

-- Get recent vanity keypairs
CREATE OR REPLACE FUNCTION public.backend_get_recent_vanity_keypairs(
  p_suffix TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  suffix TEXT,
  public_key TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  used_for_token_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT vk.id, vk.suffix, vk.public_key, vk.status, vk.created_at, vk.used_for_token_id
  FROM public.vanity_keypairs vk
  WHERE (p_suffix IS NULL OR vk.suffix = lower(p_suffix))
  ORDER BY vk.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Get used vanity keypairs with token info
CREATE OR REPLACE FUNCTION public.backend_get_used_vanity_keypairs(p_limit INT DEFAULT 10)
RETURNS TABLE(
  id UUID,
  suffix TEXT,
  public_key TEXT,
  created_at TIMESTAMPTZ,
  token_id UUID,
  token_name TEXT,
  token_ticker TEXT,
  mint_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vk.id, vk.suffix, vk.public_key, vk.created_at,
    t.id as token_id, t.name as token_name, t.ticker as token_ticker, t.mint_address
  FROM public.vanity_keypairs vk
  LEFT JOIN public.tokens t ON vk.used_for_token_id = t.id
  WHERE vk.status = 'used'
  ORDER BY vk.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Reserve an available vanity address
CREATE OR REPLACE FUNCTION public.backend_reserve_vanity_address(p_suffix TEXT)
RETURNS TABLE(
  id UUID,
  public_key TEXT,
  secret_key_encrypted TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Select and lock first available
  SELECT vk.id, vk.public_key, vk.secret_key_encrypted INTO v_record
  FROM public.vanity_keypairs vk
  WHERE vk.suffix = lower(p_suffix) AND vk.status = 'available'
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Update to reserved
  UPDATE public.vanity_keypairs SET status = 'reserved' WHERE vanity_keypairs.id = v_record.id;
  
  RETURN QUERY SELECT v_record.id, v_record.public_key, v_record.secret_key_encrypted;
END;
$$;

-- Mark vanity address as used
CREATE OR REPLACE FUNCTION public.backend_mark_vanity_used(p_keypair_id UUID, p_token_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.vanity_keypairs 
  SET status = 'used', used_for_token_id = p_token_id
  WHERE id = p_keypair_id;
END;
$$;

-- Release a reserved vanity address back to available
CREATE OR REPLACE FUNCTION public.backend_release_vanity_address(p_keypair_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.vanity_keypairs 
  SET status = 'available'
  WHERE id = p_keypair_id AND status = 'reserved';
END;
$$;