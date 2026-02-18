-- Create RPC that atomically fetches AND reserves a specific vanity keypair
CREATE OR REPLACE FUNCTION public.backend_get_and_reserve_specific_vanity_keypair(p_keypair_id uuid)
 RETURNS TABLE(id uuid, public_key text, secret_key_encrypted text, status text, suffix text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update status to reserved atomically (only if not already used)
  UPDATE public.vanity_keypairs 
  SET status = 'reserved'
  WHERE vanity_keypairs.id = p_keypair_id
    AND vanity_keypairs.status != 'used';

  -- Return the record regardless
  RETURN QUERY
  SELECT vk.id, vk.public_key, vk.secret_key_encrypted, vk.status, vk.suffix
  FROM public.vanity_keypairs vk
  WHERE vk.id = p_keypair_id;
END;
$function$