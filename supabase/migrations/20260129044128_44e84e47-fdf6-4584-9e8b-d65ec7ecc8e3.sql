-- Create job queue table for async token creation
CREATE TABLE IF NOT EXISTS public.fun_token_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  website_url TEXT,
  twitter_url TEXT,
  creator_wallet TEXT NOT NULL,
  client_ip TEXT,
  -- Results (populated on completion)
  mint_address TEXT,
  dbc_pool_address TEXT,
  fun_token_id UUID,
  error_message TEXT,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for polling
CREATE INDEX idx_fun_token_jobs_status ON public.fun_token_jobs(status);
CREATE INDEX idx_fun_token_jobs_creator ON public.fun_token_jobs(creator_wallet);

-- Enable RLS
ALTER TABLE public.fun_token_jobs ENABLE ROW LEVEL SECURITY;

-- Public read for polling
CREATE POLICY "Anyone can read token jobs" ON public.fun_token_jobs FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service role can manage jobs" ON public.fun_token_jobs FOR ALL USING (true) WITH CHECK (true);

-- Function to create a job
CREATE OR REPLACE FUNCTION public.backend_create_token_job(
  p_name TEXT,
  p_ticker TEXT,
  p_creator_wallet TEXT,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_website_url TEXT DEFAULT NULL,
  p_twitter_url TEXT DEFAULT NULL,
  p_client_ip TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.fun_token_jobs (
    name, ticker, description, image_url, website_url, twitter_url, creator_wallet, client_ip, status
  ) VALUES (
    p_name, p_ticker, p_description, p_image_url, p_website_url, p_twitter_url, p_creator_wallet, p_client_ip, 'pending'
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to complete a job
CREATE OR REPLACE FUNCTION public.backend_complete_token_job(
  p_job_id UUID,
  p_mint_address TEXT,
  p_dbc_pool_address TEXT,
  p_fun_token_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fun_token_jobs SET
    status = 'completed',
    mint_address = p_mint_address,
    dbc_pool_address = p_dbc_pool_address,
    fun_token_id = p_fun_token_id,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- Function to fail a job
CREATE OR REPLACE FUNCTION public.backend_fail_token_job(
  p_job_id UUID,
  p_error_message TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fun_token_jobs SET
    status = 'failed',
    error_message = p_error_message,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;