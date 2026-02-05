-- Create storage bucket for trading agent avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('trading-agents', 'trading-agents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to trading agent avatars
CREATE POLICY "Trading agent avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'trading-agents');

-- Allow edge functions to upload avatars (service role)
CREATE POLICY "Service role can upload trading agent avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'trading-agents');