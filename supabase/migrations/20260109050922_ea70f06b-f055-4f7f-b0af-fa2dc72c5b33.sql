-- Remove dependency on auth.users since this app uses Privy-mapped UUIDs
-- This fixes sync-privy-user failing with: profiles_id_fkey (id not present in auth.users)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;