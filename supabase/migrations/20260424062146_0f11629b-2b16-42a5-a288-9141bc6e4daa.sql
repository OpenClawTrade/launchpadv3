-- Storage bucket to persist compiled Solidity artifacts so the deploy function
-- can read them at deploy time. Public-read for transparency (artifacts are
-- bytecode you'd publish to Etherscan anyway), service-role-only writes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-artifacts', 'contract-artifacts', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (artifacts are non-sensitive compiled bytecode)
DROP POLICY IF EXISTS "Public read contract artifacts" ON storage.objects;
CREATE POLICY "Public read contract artifacts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contract-artifacts');

-- Only service-role (edge functions) may write/update/delete
DROP POLICY IF EXISTS "Service role writes contract artifacts" ON storage.objects;
CREATE POLICY "Service role writes contract artifacts"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'contract-artifacts');

DROP POLICY IF EXISTS "Service role updates contract artifacts" ON storage.objects;
CREATE POLICY "Service role updates contract artifacts"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'contract-artifacts');

DROP POLICY IF EXISTS "Service role deletes contract artifacts" ON storage.objects;
CREATE POLICY "Service role deletes contract artifacts"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'contract-artifacts');