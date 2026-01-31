-- Create token_promotions table for tracking paid promotions
CREATE TABLE public.token_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id uuid REFERENCES public.fun_tokens(id) ON DELETE CASCADE NOT NULL,
  promoter_wallet text NOT NULL,
  payment_address text NOT NULL,
  payment_private_key text NOT NULL,
  amount_sol numeric NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'pending',
  signature text,
  twitter_post_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  posted_at timestamptz,
  expires_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'posted', 'expired', 'failed'))
);

-- Create indexes for common queries
CREATE INDEX idx_token_promotions_fun_token_id ON public.token_promotions(fun_token_id);
CREATE INDEX idx_token_promotions_status ON public.token_promotions(status);
CREATE INDEX idx_token_promotions_expires_at ON public.token_promotions(expires_at) WHERE status = 'posted';
CREATE INDEX idx_token_promotions_payment_address ON public.token_promotions(payment_address);

-- Enable RLS
ALTER TABLE public.token_promotions ENABLE ROW LEVEL SECURITY;

-- Anyone can view promotions (needed for displaying promoted status)
CREATE POLICY "Anyone can view promotions"
ON public.token_promotions
FOR SELECT
USING (true);

-- Deny direct INSERT/UPDATE/DELETE (handled by backend functions)
CREATE POLICY "Deny direct promotion inserts"
ON public.token_promotions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny direct promotion updates"
ON public.token_promotions
FOR UPDATE
USING (false);

CREATE POLICY "Deny direct promotion deletes"
ON public.token_promotions
FOR DELETE
USING (false);

-- Create SECURITY DEFINER function for backend to create promotions
CREATE OR REPLACE FUNCTION public.backend_create_promotion(
  p_fun_token_id uuid,
  p_promoter_wallet text,
  p_payment_address text,
  p_payment_private_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion_id uuid;
BEGIN
  INSERT INTO token_promotions (
    fun_token_id,
    promoter_wallet,
    payment_address,
    payment_private_key,
    status
  ) VALUES (
    p_fun_token_id,
    p_promoter_wallet,
    p_payment_address,
    p_payment_private_key,
    'pending'
  )
  RETURNING id INTO v_promotion_id;
  
  RETURN v_promotion_id;
END;
$$;

-- Create SECURITY DEFINER function to update promotion status
CREATE OR REPLACE FUNCTION public.backend_update_promotion_status(
  p_promotion_id uuid,
  p_status text,
  p_signature text DEFAULT NULL,
  p_twitter_post_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE token_promotions
  SET 
    status = p_status,
    signature = COALESCE(p_signature, signature),
    twitter_post_id = COALESCE(p_twitter_post_id, twitter_post_id),
    paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END,
    posted_at = CASE WHEN p_status = 'posted' THEN now() ELSE posted_at END,
    expires_at = CASE WHEN p_status = 'posted' THEN now() + interval '24 hours' ELSE expires_at END
  WHERE id = p_promotion_id;
  
  RETURN FOUND;
END;
$$;

-- Create function to get active promotion for a token
CREATE OR REPLACE FUNCTION public.get_active_promotion(p_fun_token_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  posted_at timestamptz,
  expires_at timestamptz,
  twitter_post_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tp.id,
    tp.status,
    tp.posted_at,
    tp.expires_at,
    tp.twitter_post_id
  FROM token_promotions tp
  WHERE tp.fun_token_id = p_fun_token_id
    AND tp.status = 'posted'
    AND tp.expires_at > now()
  ORDER BY tp.posted_at DESC
  LIMIT 1;
$$;