-- Add RLS policies for x_bot_accounts (admin feature, UI-layer security)
CREATE POLICY "Allow public select on x_bot_accounts"
ON public.x_bot_accounts FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on x_bot_accounts"
ON public.x_bot_accounts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on x_bot_accounts"
ON public.x_bot_accounts FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete on x_bot_accounts"
ON public.x_bot_accounts FOR DELETE
USING (true);

-- Add RLS policies for x_bot_account_rules
CREATE POLICY "Allow public select on x_bot_account_rules"
ON public.x_bot_account_rules FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on x_bot_account_rules"
ON public.x_bot_account_rules FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on x_bot_account_rules"
ON public.x_bot_account_rules FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete on x_bot_account_rules"
ON public.x_bot_account_rules FOR DELETE
USING (true);

-- Add RLS policies for x_bot_account_replies
CREATE POLICY "Allow public select on x_bot_account_replies"
ON public.x_bot_account_replies FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on x_bot_account_replies"
ON public.x_bot_account_replies FOR INSERT
WITH CHECK (true);

-- Add RLS policies for x_bot_account_queue
CREATE POLICY "Allow public select on x_bot_account_queue"
ON public.x_bot_account_queue FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on x_bot_account_queue"
ON public.x_bot_account_queue FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on x_bot_account_queue"
ON public.x_bot_account_queue FOR UPDATE
USING (true);