-- Fix the backend_create_agent_verification function to use gen_random_uuid instead of gen_random_bytes
CREATE OR REPLACE FUNCTION public.backend_create_agent_verification(p_agent_id uuid)
 RETURNS TABLE(challenge text, nonce text, expires_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nonce TEXT;
  v_challenge TEXT;
  v_expires TIMESTAMPTZ;
  v_agent RECORD;
BEGIN
  -- Get agent info
  SELECT name, wallet_address INTO v_agent
  FROM agents WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;
  
  -- Generate nonce using gen_random_uuid (always available in Supabase)
  v_nonce := replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '5 minutes';
  
  -- Build challenge message
  v_challenge := format(
    E'TUNA Agent Ownership Verification\n\nAgent: %s\nWallet: %s\nTimestamp: %s\nNonce: %s\n\nSign this message to prove you own this agent.',
    v_agent.name,
    v_agent.wallet_address,
    extract(epoch from now())::bigint,
    v_nonce
  );
  
  -- Delete old pending verifications for this agent
  DELETE FROM agent_verifications 
  WHERE agent_id = p_agent_id AND verified_at IS NULL;
  
  -- Insert new verification
  INSERT INTO agent_verifications (agent_id, challenge, nonce, expires_at)
  VALUES (p_agent_id, v_challenge, v_nonce, v_expires);
  
  RETURN QUERY SELECT v_challenge, v_nonce, v_expires;
END;
$function$;