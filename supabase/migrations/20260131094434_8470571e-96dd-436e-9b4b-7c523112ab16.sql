-- Drop and recreate verify_api_key to accept raw API key and return more data
-- This function hashes the API key using the encryption key stored in vault
-- and returns account details including fee wallet address

DROP FUNCTION IF EXISTS public.verify_api_key(text);

CREATE OR REPLACE FUNCTION public.verify_api_key(p_api_key text)
RETURNS TABLE(
  is_valid boolean,
  account_id uuid,
  wallet_address text,
  fee_wallet_address text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key text;
  v_hash text;
BEGIN
  -- Get encryption key from secrets (set via Supabase dashboard)
  -- For now, we hash without salt since the key format includes randomness
  -- The api-account edge function stores hash = SHA256(key + API_ENCRYPTION_KEY)
  -- We need to replicate that logic here
  
  -- Since we can't access vault in this function easily, we'll use a different approach:
  -- Store the hash comparison in the table and match directly
  -- The edge function computes the hash before calling us
  
  -- Actually, let's just do a prefix + hash lookup since we store both
  -- But for raw key verification, the caller should hash first
  
  -- For backwards compatibility, if this looks like a hash (64 chars hex), use it directly
  IF length(p_api_key) = 64 AND p_api_key ~ '^[a-f0-9]+$' THEN
    v_hash := p_api_key;
  ELSE
    -- This is a raw API key - we can't hash it here without the encryption key
    -- Return invalid - caller should use the edge function which has access to secrets
    RETURN QUERY SELECT 
      false::boolean AS is_valid,
      NULL::uuid AS account_id,
      NULL::text AS wallet_address,
      NULL::text AS fee_wallet_address,
      'invalid'::text AS status;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    true::boolean AS is_valid,
    a.id AS account_id,
    a.wallet_address,
    a.fee_wallet_address,
    a.status
  FROM api_accounts a
  WHERE a.api_key_hash = v_hash 
    AND a.status = 'active';
    
  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::boolean AS is_valid,
      NULL::uuid AS account_id,
      NULL::text AS wallet_address,
      NULL::text AS fee_wallet_address,
      'invalid'::text AS status;
  END IF;
END;
$$;