
-- Add wallet_address column to console_messages
ALTER TABLE public.console_messages ADD COLUMN wallet_address text;

-- Create console_tips table for audit trail
CREATE TABLE public.console_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_wallet text NOT NULL,
  recipient_display_name text NOT NULL,
  amount_sol numeric NOT NULL,
  signature text NOT NULL,
  treasury_balance_before numeric,
  message_id uuid REFERENCES public.console_messages(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: public read, no public write
ALTER TABLE public.console_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tips" ON public.console_tips FOR SELECT TO anon, authenticated USING (true);
