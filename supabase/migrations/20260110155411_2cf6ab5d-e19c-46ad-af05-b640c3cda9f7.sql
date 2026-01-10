-- Create token_price_history table for price charts
CREATE TABLE public.token_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  price_sol NUMERIC NOT NULL,
  market_cap_sol NUMERIC NOT NULL DEFAULT 0,
  volume_sol NUMERIC NOT NULL DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  interval_type TEXT NOT NULL DEFAULT '1m', -- 1m, 5m, 15m, 1h, 4h, 1d
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_token_price_history_token_timestamp ON public.token_price_history(token_id, timestamp DESC);
CREATE INDEX idx_token_price_history_interval ON public.token_price_history(token_id, interval_type, timestamp DESC);

-- Enable RLS
ALTER TABLE public.token_price_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view price history
CREATE POLICY "Anyone can view price history" 
ON public.token_price_history 
FOR SELECT 
USING (true);

-- System can manage price history
CREATE POLICY "System can manage price history" 
ON public.token_price_history 
FOR ALL 
USING (true);

-- Create token_comments table for discussions
CREATE TABLE public.token_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL REFERENCES public.tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.token_comments(id) ON DELETE CASCADE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for comments
CREATE INDEX idx_token_comments_token ON public.token_comments(token_id, created_at DESC);
CREATE INDEX idx_token_comments_parent ON public.token_comments(parent_id);

-- Enable RLS
ALTER TABLE public.token_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view comments
CREATE POLICY "Anyone can view token comments" 
ON public.token_comments 
FOR SELECT 
USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments" 
ON public.token_comments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" 
ON public.token_comments 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" 
ON public.token_comments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add price_change_24h column to tokens
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS price_change_24h NUMERIC DEFAULT 0;
ALTER TABLE public.tokens ADD COLUMN IF NOT EXISTS price_24h_ago NUMERIC DEFAULT 0;

-- Function to record price history after each swap
CREATE OR REPLACE FUNCTION public.record_token_price_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert 1-minute candle
  INSERT INTO public.token_price_history (token_id, price_sol, market_cap_sol, volume_sol, interval_type, timestamp)
  VALUES (NEW.id, NEW.price_sol, NEW.market_cap_sol, NEW.volume_24h_sol, '1m', now())
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to record price history on token updates
CREATE TRIGGER record_price_history_trigger
AFTER UPDATE OF price_sol ON public.tokens
FOR EACH ROW
WHEN (OLD.price_sol IS DISTINCT FROM NEW.price_sol)
EXECUTE FUNCTION public.record_token_price_history();

-- Function to calculate 24h volume from transactions
CREATE OR REPLACE FUNCTION public.update_token_24h_stats()
RETURNS void AS $$
DECLARE
  token_record RECORD;
  vol_24h NUMERIC;
  price_24h NUMERIC;
  change_24h NUMERIC;
BEGIN
  FOR token_record IN SELECT id FROM public.tokens LOOP
    -- Calculate 24h volume
    SELECT COALESCE(SUM(sol_amount), 0) INTO vol_24h
    FROM public.launchpad_transactions
    WHERE token_id = token_record.id
      AND created_at > now() - interval '24 hours';
    
    -- Get price from 24h ago
    SELECT price_sol INTO price_24h
    FROM public.token_price_history
    WHERE token_id = token_record.id
      AND timestamp <= now() - interval '24 hours'
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Calculate price change
    IF price_24h IS NOT NULL AND price_24h > 0 THEN
      SELECT ((t.price_sol - price_24h) / price_24h) * 100 INTO change_24h
      FROM public.tokens t WHERE t.id = token_record.id;
    ELSE
      change_24h := 0;
    END IF;
    
    -- Update token stats
    UPDATE public.tokens
    SET volume_24h_sol = vol_24h,
        price_24h_ago = COALESCE(price_24h, price_sol),
        price_change_24h = COALESCE(change_24h, 0),
        updated_at = now()
    WHERE id = token_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_price_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_comments;