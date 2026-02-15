
-- Whale scan sessions table
CREATE TABLE public.whale_scan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  min_sol numeric NOT NULL DEFAULT 10,
  slots_per_call integer NOT NULL DEFAULT 5,
  last_slot bigint,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  total_slots_scanned integer NOT NULL DEFAULT 0,
  total_swaps integer NOT NULL DEFAULT 0,
  total_transfers integer NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  last_error text,
  last_poll_at timestamptz DEFAULT now()
);

-- Whale addresses table
CREATE TABLE public.whale_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.whale_scan_sessions(id) ON DELETE CASCADE,
  address text NOT NULL,
  times_seen integer NOT NULL DEFAULT 1,
  total_volume_sol numeric NOT NULL DEFAULT 0,
  activity_types text[] NOT NULL DEFAULT '{}',
  sources text[] NOT NULL DEFAULT '{}',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, address)
);

-- Index for fast lookups
CREATE INDEX idx_whale_addresses_session ON public.whale_addresses(session_id);
CREATE INDEX idx_whale_scan_sessions_status ON public.whale_scan_sessions(status);

-- RLS disabled - admin-only usage
ALTER TABLE public.whale_scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whale_addresses ENABLE ROW LEVEL SECURITY;

-- Allow all operations (admin tool, no user-facing access)
CREATE POLICY "Allow all on whale_scan_sessions" ON public.whale_scan_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on whale_addresses" ON public.whale_addresses FOR ALL USING (true) WITH CHECK (true);
