
-- Drop existing RLS policies that reference auth.uid()
DROP POLICY IF EXISTS "Users can read own keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can insert own keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can update own keys" ON public.user_api_keys;
DROP POLICY IF EXISTS "Users can delete own keys" ON public.user_api_keys;

-- Rename user_id to profile_id and change type to text
ALTER TABLE public.user_api_keys DROP COLUMN user_id;
ALTER TABLE public.user_api_keys ADD COLUMN profile_id TEXT NOT NULL;

-- Drop old unique constraint and add new one
DROP INDEX IF EXISTS user_api_keys_user_id_exchange_key;
CREATE UNIQUE INDEX user_api_keys_profile_exchange_key ON public.user_api_keys (profile_id, exchange);

-- No RLS policies needed — edge function uses service role to access this table
