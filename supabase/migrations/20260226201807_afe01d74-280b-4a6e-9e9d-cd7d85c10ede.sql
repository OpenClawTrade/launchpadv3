
CREATE TABLE public.punch_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('user', 'punch')),
  content TEXT NOT NULL,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow public read/insert (no auth required for this public chat)
ALTER TABLE public.punch_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read punch chat messages"
  ON public.punch_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert punch chat messages"
  ON public.punch_chat_messages FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_chat_messages;
