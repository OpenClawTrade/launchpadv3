-- Create a SECURITY DEFINER function to fetch a specific vanity keypair by ID
-- This bypasses RLS so both anon and service role can use it safely
CREATE OR REPLACE FUNCTION public.backend_get_specific_vanity_keypair(p_keypair_id uuid)
RETURNS TABLE(id uuid, public_key text, secret_key_encrypted text, status text, suffix text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT vk.id, vk.public_key, vk.secret_key_encrypted, vk.status, vk.suffix
  FROM public.vanity_keypairs vk
  WHERE vk.id = p_keypair_id;
END;
$function$;