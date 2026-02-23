-- Drop the FK constraint that prevents recording distributions for fun_tokens
ALTER TABLE public.claw_distributions DROP CONSTRAINT IF EXISTS claw_distributions_fun_token_id_fkey;

-- Add an INSERT policy so service role inserts work cleanly
CREATE POLICY "Allow service role insert on claw_distributions"
ON public.claw_distributions
FOR INSERT
WITH CHECK (true);