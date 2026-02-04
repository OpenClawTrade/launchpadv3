-- Create table for tracking launch idempotency locks
CREATE TABLE public.launch_idempotency_locks (
  idempotency_key UUID PRIMARY KEY,
  creator_wallet TEXT NOT NULL,
  ticker TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  result_mint_address TEXT,
  result_token_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create partial unique index for processing status only (immutable condition)
CREATE UNIQUE INDEX idx_prevent_dup_processing
  ON public.launch_idempotency_locks (lower(ticker), creator_wallet)
  WHERE status = 'processing';

-- Index for cleanup queries and cooldown checks
CREATE INDEX idx_launch_locks_created_at ON public.launch_idempotency_locks (created_at);
CREATE INDEX idx_launch_locks_ticker_wallet ON public.launch_idempotency_locks (lower(ticker), creator_wallet, status, created_at DESC);

-- Add unique constraint on fun_tokens.mint_address as last line of defense
ALTER TABLE public.fun_tokens 
  ADD CONSTRAINT fun_tokens_mint_address_unique UNIQUE (mint_address);

-- RPC function to acquire a launch lock atomically
CREATE OR REPLACE FUNCTION public.backend_acquire_launch_lock(
  p_idempotency_key UUID,
  p_creator_wallet TEXT,
  p_ticker TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing RECORD;
  v_ticker_upper TEXT;
BEGIN
  v_ticker_upper := upper(p_ticker);
  
  -- First check for cooldown (completed within last 10 minutes)
  SELECT * INTO v_existing 
  FROM launch_idempotency_locks 
  WHERE lower(ticker) = lower(v_ticker_upper) 
    AND creator_wallet = p_creator_wallet
    AND status = 'completed'
    AND created_at > now() - interval '10 minutes'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'cooldown',
      'existing', jsonb_build_object(
        'result_mint_address', v_existing.result_mint_address,
        'result_token_id', v_existing.result_token_id
      ),
      'cooldown_remaining_seconds', EXTRACT(EPOCH FROM (v_existing.created_at + interval '10 minutes' - now()))::int
    );
  END IF;
  
  -- Try to insert the lock
  BEGIN
    INSERT INTO launch_idempotency_locks (idempotency_key, creator_wallet, ticker, status)
    VALUES (p_idempotency_key, p_creator_wallet, v_ticker_upper, 'processing');
    
    RETURN jsonb_build_object('acquired', true, 'existing', null);
  EXCEPTION WHEN unique_violation THEN
    -- Check if it's the same idempotency key (retry of same request)
    SELECT * INTO v_existing 
    FROM launch_idempotency_locks 
    WHERE idempotency_key = p_idempotency_key;
    
    IF FOUND THEN
      IF v_existing.status = 'completed' THEN
        RETURN jsonb_build_object(
          'acquired', false,
          'reason', 'already_completed',
          'existing', jsonb_build_object(
            'result_mint_address', v_existing.result_mint_address,
            'result_token_id', v_existing.result_token_id
          )
        );
      ELSIF v_existing.status = 'processing' THEN
        RETURN jsonb_build_object('acquired', false, 'reason', 'in_progress', 'existing', null);
      ELSE
        -- Failed status - allow retry by updating to processing
        UPDATE launch_idempotency_locks 
        SET status = 'processing', created_at = now(), completed_at = null
        WHERE idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('acquired', true, 'existing', null);
      END IF;
    END IF;
    
    -- Different idempotency key but same ticker+wallet currently processing
    SELECT * INTO v_existing 
    FROM launch_idempotency_locks 
    WHERE lower(ticker) = lower(v_ticker_upper) 
      AND creator_wallet = p_creator_wallet
      AND status = 'processing'
    LIMIT 1;
    
    IF FOUND THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'in_progress', 'existing', null);
    END IF;
    
    -- Should not reach here, but just in case
    RETURN jsonb_build_object('acquired', false, 'reason', 'unknown_conflict', 'existing', null);
  END;
END;
$$;

-- RPC function to complete a launch lock
CREATE OR REPLACE FUNCTION public.backend_complete_launch_lock(
  p_idempotency_key UUID,
  p_mint_address TEXT,
  p_token_id UUID,
  p_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE launch_idempotency_locks
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    result_mint_address = p_mint_address,
    result_token_id = p_token_id,
    completed_at = now()
  WHERE idempotency_key = p_idempotency_key;
END;
$$;

-- Cleanup function to remove stale locks older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_old_launch_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.launch_idempotency_locks
  WHERE created_at < now() - INTERVAL '1 hour';
END;
$$;