DROP POLICY IF EXISTS "Anyone can read alpha trades" ON public.alpha_trades;
CREATE POLICY "Anyone can read alpha trades" ON public.alpha_trades FOR SELECT TO anon, authenticated USING (true);