-- Create public storage bucket for bonding token images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bonding-token-images',
  'bonding-token-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

-- Public read access
CREATE POLICY "Bonding token images are publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bonding-token-images');

-- Anyone can upload (token creation is open)
CREATE POLICY "Anyone can upload bonding token images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'bonding-token-images');