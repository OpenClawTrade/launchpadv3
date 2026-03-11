
CREATE TABLE public.kol_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  accounts_scanned int NOT NULL DEFAULT 0,
  tweets_fetched int NOT NULL DEFAULT 0,
  cas_detected int NOT NULL DEFAULT 0,
  tweets_inserted int NOT NULL DEFAULT 0,
  errors_count int NOT NULL DEFAULT 0,
  duration_ms int,
  raw_response_sample text
);

CREATE TABLE public.kol_scan_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.kol_scan_runs(id) ON DELETE CASCADE,
  kol_username text NOT NULL,
  error_message text NOT NULL,
  raw_response_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kol_scan_runs_created ON public.kol_scan_runs(created_at DESC);
CREATE INDEX idx_kol_scan_errors_run ON public.kol_scan_errors(run_id);

ALTER TABLE public.kol_scan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_scan_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scan runs" ON public.kol_scan_runs FOR SELECT USING (true);
CREATE POLICY "Anyone can read scan errors" ON public.kol_scan_errors FOR SELECT USING (true);
