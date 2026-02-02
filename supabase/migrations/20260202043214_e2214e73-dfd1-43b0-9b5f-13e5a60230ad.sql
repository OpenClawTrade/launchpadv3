-- Make fun_token_id nullable for pre-creation before token launch
ALTER TABLE public.subtuna 
  ALTER COLUMN fun_token_id DROP NOT NULL;

-- Add ticker column for URL generation before token exists
ALTER TABLE public.subtuna 
  ADD COLUMN IF NOT EXISTS ticker TEXT;

-- Add index for ticker lookups
CREATE INDEX IF NOT EXISTS idx_subtuna_ticker 
  ON public.subtuna(ticker);