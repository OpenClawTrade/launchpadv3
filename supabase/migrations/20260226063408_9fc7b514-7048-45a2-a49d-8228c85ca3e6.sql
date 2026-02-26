CREATE TABLE public.punch_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id uuid NOT NULL REFERENCES public.fun_tokens(id) ON DELETE CASCADE,
  voter_fingerprint text NOT NULL,
  vote_type smallint NOT NULL CHECK (vote_type IN (1, -1)),
  created_at timestamptz DEFAULT now(),
  UNIQUE(fun_token_id, voter_fingerprint)
);

ALTER TABLE public.punch_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read punch votes" ON public.punch_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert punch votes" ON public.punch_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own punch votes" ON public.punch_votes FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_votes;