-- Create API webhooks table for event notifications
CREATE TABLE public.api_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_account_id UUID REFERENCES public.api_accounts(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS - service role only for security
ALTER TABLE public.api_webhooks ENABLE ROW LEVEL SECURITY;

-- Policy: Deny all direct access (use backend functions only)
CREATE POLICY "Deny direct access to api_webhooks"
ON public.api_webhooks
FOR ALL
USING (false);

-- Add API account attribution to tokens
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS api_account_id UUID REFERENCES public.api_accounts(id);

-- Add API account attribution to fun_tokens  
ALTER TABLE public.fun_tokens ADD COLUMN IF NOT EXISTS api_account_id UUID REFERENCES public.api_accounts(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tokens_api_account_id ON public.tokens(api_account_id);
CREATE INDEX IF NOT EXISTS idx_fun_tokens_api_account_id ON public.fun_tokens(api_account_id);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_api_account_id ON public.api_webhooks(api_account_id);

-- Function to manage webhooks (SECURITY DEFINER for backend use)
CREATE OR REPLACE FUNCTION public.backend_manage_webhook(
  p_api_account_id UUID,
  p_action TEXT, -- 'create', 'update', 'delete', 'list'
  p_webhook_id UUID DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_events TEXT[] DEFAULT NULL,
  p_secret TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_webhook_id UUID;
BEGIN
  CASE p_action
    WHEN 'create' THEN
      INSERT INTO api_webhooks (api_account_id, url, events, secret, is_active)
      VALUES (p_api_account_id, p_url, p_events, p_secret, p_is_active)
      RETURNING id INTO v_webhook_id;
      
      SELECT jsonb_build_object(
        'success', true,
        'webhook_id', v_webhook_id
      ) INTO v_result;
      
    WHEN 'update' THEN
      UPDATE api_webhooks
      SET 
        url = COALESCE(p_url, url),
        events = COALESCE(p_events, events),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = now()
      WHERE id = p_webhook_id AND api_account_id = p_api_account_id;
      
      SELECT jsonb_build_object('success', true) INTO v_result;
      
    WHEN 'delete' THEN
      DELETE FROM api_webhooks 
      WHERE id = p_webhook_id AND api_account_id = p_api_account_id;
      
      SELECT jsonb_build_object('success', true) INTO v_result;
      
    WHEN 'list' THEN
      SELECT jsonb_build_object(
        'success', true,
        'webhooks', COALESCE(jsonb_agg(jsonb_build_object(
          'id', w.id,
          'url', w.url,
          'events', w.events,
          'is_active', w.is_active,
          'last_triggered_at', w.last_triggered_at,
          'failure_count', w.failure_count,
          'created_at', w.created_at
        )), '[]'::jsonb)
      ) INTO v_result
      FROM api_webhooks w
      WHERE w.api_account_id = p_api_account_id;
      
    ELSE
      SELECT jsonb_build_object('success', false, 'error', 'Invalid action') INTO v_result;
  END CASE;
  
  RETURN v_result;
END;
$$;

-- Function to attribute token to API account
CREATE OR REPLACE FUNCTION public.backend_attribute_token_to_api(
  p_token_id UUID,
  p_api_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE tokens SET api_account_id = p_api_account_id WHERE id = p_token_id;
  UPDATE fun_tokens SET api_account_id = p_api_account_id WHERE id = p_token_id;
  RETURN true;
END;
$$;