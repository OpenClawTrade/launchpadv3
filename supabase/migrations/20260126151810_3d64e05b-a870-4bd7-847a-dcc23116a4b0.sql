-- Store temporary metadata for Phantom launches so explorers can fetch an image immediately
-- (before the token is recorded in fun_tokens/tokens).

CREATE TABLE IF NOT EXISTS public.pending_token_metadata (
  mint_address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT NULL,
  image_url TEXT NULL,
  website_url TEXT NULL,
  twitter_url TEXT NULL,
  telegram_url TEXT NULL,
  discord_url TEXT NULL,
  creator_wallet TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NULL
);

ALTER TABLE public.pending_token_metadata ENABLE ROW LEVEL SECURITY;

-- Public read: required because token metadata URI is fetched by third parties (explorers, wallets)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_token_metadata'
      AND policyname = 'Pending token metadata is publicly readable'
  ) THEN
    CREATE POLICY "Pending token metadata is publicly readable"
    ON public.pending_token_metadata
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_pending_token_metadata_updated_at ON public.pending_token_metadata;
CREATE TRIGGER update_pending_token_metadata_updated_at
BEFORE UPDATE ON public.pending_token_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pending_token_metadata_created_at
ON public.pending_token_metadata (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_token_metadata_expires_at
ON public.pending_token_metadata (expires_at);