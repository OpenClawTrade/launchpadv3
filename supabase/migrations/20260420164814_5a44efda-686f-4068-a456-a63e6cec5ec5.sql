
INSERT INTO storage.buckets (id, name, public)
VALUES ('token-images', 'token-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Token images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'token-images');

CREATE POLICY "Anyone can upload token images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'token-images');
