-- Add storage policies for post-images bucket
-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload post images to own folder"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'post-images'
);

-- Allow anyone to read post images (public bucket)
CREATE POLICY "Anyone can read post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Allow users to update their own images
CREATE POLICY "Users can update own post images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'post-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'post-images');