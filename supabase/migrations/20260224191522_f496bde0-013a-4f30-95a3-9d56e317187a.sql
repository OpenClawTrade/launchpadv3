
CREATE TABLE public.console_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  content text NOT NULL,
  is_bot boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_console_messages_created_at ON public.console_messages(created_at DESC);

ALTER TABLE public.console_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read console messages"
  ON public.console_messages FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert console messages"
  ON public.console_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.console_messages;
