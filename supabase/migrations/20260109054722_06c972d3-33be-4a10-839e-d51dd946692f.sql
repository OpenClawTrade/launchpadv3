-- Add storage policies for profile-images bucket
CREATE POLICY "Users can upload profile images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'profile-images');

CREATE POLICY "Anyone can read profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can update profile images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can delete profile images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'profile-images');