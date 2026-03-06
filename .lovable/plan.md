

## Profit Card Popup + Referral System

### Overview
After each successful trade, show a modal with a Binance-style "profit card" image containing the user's PnL, token info, QR code (referral link), and options to share to X or download the image. Also build a full referral tracking system with unique short links (`/link/{shortId}`).

### Database Changes (2 migrations)

**Migration 1: Referral system tables**
```sql
-- Short referral codes table
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL, -- short 6-8 char alphanumeric
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_referral_codes_profile ON public.referral_codes(profile_id);

-- Referral tracking table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_wallet TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id) -- each user can only be referred once
);

-- RLS policies
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Users can insert own referral code" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Anyone can read referral codes" ON public.referral_codes FOR SELECT TO anon USING (true);

CREATE POLICY "Users can read own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid());
CREATE POLICY "System can insert referrals" ON public.referrals FOR INSERT TO authenticated WITH CHECK (referred_id = auth.uid());
```

**Migration 2: Function to generate unique short code**
```sql
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT code INTO v_code FROM referral_codes WHERE profile_id = p_profile_id;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  
  -- Generate unique 6-char code
  LOOP
    v_code := substr(md5(random()::text), 1, 6);
    BEGIN
      INSERT INTO referral_codes (profile_id, code) VALUES (p_profile_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- retry with new code
    END;
  END LOOP;
END;
$$;
```

### New Files

**1. `src/hooks/useReferral.ts`**
- `useReferralCode()` — fetches/creates the user's unique referral code via the DB function
- `useTrackReferral()` — on app load, checks URL for `/link/{code}`, stores in localStorage, and on first auth records the referral in the DB
- Returns `referralCode`, `referralLink` (`domain.com/link/{code}`), `referralCount`

**2. `src/components/launchpad/ProfitCardModal.tsx`**
- Full-screen dialog with a canvas-rendered "profit card" matching the Binance Futures style:
  - Dark gradient background (#0a0e17 → #1a1f2e)
  - Platform logo + "FUTURES" style header
  - User display name / wallet truncated
  - PnL data: ROI %, absolute profit in SOL (large green text)
  - Token name + ticker
  - Trade type (Buy/Sell), amount
  - QR code (from `react-qr-code`) encoding the user's referral link
  - Referral code text below QR
  - Timestamp
- **Share to X** button: opens Twitter intent with text + downloads image
- **Save Image** button: uses `html2canvas` or canvas API to render the card div as PNG and trigger download
- The card is rendered in a fixed-size div (600x400) for consistent screenshots

**3. `src/pages/ReferralRedirectPage.tsx`**
- Route: `/link/:code`
- On mount: looks up `code` in `referral_codes` table, stores `referrer_profile_id` in `localStorage('ref')`
- Redirects to `/` immediately
- When user later signs up/logs in, the `useTrackReferral` hook reads localStorage and creates the referral record

### Modified Files

**4. `src/App.tsx`**
- Add route: `<Route path="/link/:code" element={<ReferralRedirectPage />} />`

**5. `src/components/launchpad/UniversalTradePanel.tsx`** (lines ~198-217)
- After successful trade toast, set state to show `ProfitCardModal` with trade details (action, amount, token info, PnL)
- Add `<ProfitCardModal>` at the bottom of the component

**6. `src/components/launchpad/TradePanelWithSwap.tsx`** (lines ~120-132)
- Same pattern: after successful trade, show `ProfitCardModal`

### Profit Card Visual Layout (matching reference image)
```text
┌─────────────────────────────────┐
│  🐾 CLAWMODE | Trading         │
│                                 │
│  👤 username / 0x4a...3f        │
│                                 │
│  P&L          Amount            │
│  +93.81%    +35,845 SOL    🚀  │
│  (green)     (green)            │
│                                 │
│  ┌────────┐                     │
│  │ QR CODE│  Referral Code      │
│  │        │  domain.com/link/x  │
│  └────────┘                     │
│                    Mar 6, 2026  │
└─────────────────────────────────┘
[ Share to X ]  [ Save Image ]
```

### Referral Flow
1. User A trades → sees profit card with QR code pointing to `clawmode.lovable.app/link/abc123`
2. User A shares to X or saves image
3. User B scans QR / clicks link → lands on `/link/abc123`
4. `ReferralRedirectPage` stores `ref=abc123` in localStorage, redirects to `/`
5. User B signs up → `useTrackReferral` reads localStorage, resolves code to referrer profile, inserts into `referrals` table, clears localStorage
6. Referral is permanently tracked — no loss possible since localStorage persists until consumed

