

## Merch Store for Saturn Trade

Build a full merch store at `/merch` with Solana payment checkout. The uploaded logo (transparent background version) will be placed on all merchandise mockups.

---

### What Gets Built

**1. New Assets**
- Copy `user-uploads://FullLogo_Transparent-2.png` → `src/assets/saturn-merch-logo.png` (transparent logo for product mockups)
- Copy `user-uploads://image-537.png` → `public/saturn-og-merch.png` (dark logo for OG/social)

**2. New Page: `src/pages/MerchStorePage.tsx`**
- Professional merch grid with product cards
- Hardcoded product catalog (no DB needed): T-Shirts, Hoodies, Hats, Stickers, Mugs, Phone Cases
- Each product has: image mockup with Saturn logo overlay, name, price in SOL, size/color variants
- "Add to Cart" functionality with local state
- Cart drawer/sidebar showing items, quantities, total SOL
- Checkout flow: collect shipping info (name, address, email) → generate Solana payment transaction → confirmation page
- No auth required — anyone can browse and buy
- Payment via SOL transfer to treasury wallet address (memo with order ID)

**3. Product Cards**
- Saturn-themed dark cards matching `claw-theme` styling
- Product image with the Saturn logo overlaid (CSS positioned)
- Price displayed in SOL with USD estimate (using existing `useSolPrice` hook)
- Size selector for apparel (S/M/L/XL/2XL)
- Color options where applicable

**4. Checkout Process**
- Step 1: Cart review (quantities, sizes, totals)
- Step 2: Shipping form (name, email, address, city, state, zip, country)
- Step 3: Payment — show SOL amount, user sends transaction via Privy wallet (or any connected Solana wallet)
- Step 4: Confirmation with order number and tx signature
- Orders saved to a new `merch_orders` database table for fulfillment tracking

**5. Database: `merch_orders` table**
```sql
CREATE TABLE public.merch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  buyer_wallet text,
  buyer_email text NOT NULL,
  shipping_name text NOT NULL,
  shipping_address jsonb NOT NULL,
  items jsonb NOT NULL,
  total_sol numeric NOT NULL,
  tx_signature text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
-- Public insert (anyone can place order), admin select
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert orders" ON public.merch_orders FOR INSERT WITH CHECK (true);
```

**6. Navigation**
- Add "Merch" link to `Sidebar.tsx` NAV_LINKS array (using `ShoppingBag` icon from lucide)
- Add route `/merch` → `MerchStorePage` in `App.tsx`

**7. Components Structure**
- `src/components/merch/ProductCard.tsx` — individual product display
- `src/components/merch/CartDrawer.tsx` — slide-out cart
- `src/components/merch/CheckoutFlow.tsx` — multi-step checkout
- `src/components/merch/MerchHeader.tsx` — store header with cart icon + count

---

### Files to Create
- `src/pages/MerchStorePage.tsx`
- `src/components/merch/ProductCard.tsx`
- `src/components/merch/CartDrawer.tsx`
- `src/components/merch/CheckoutFlow.tsx`
- `src/assets/saturn-merch-logo.png`

### Files to Modify
- `src/App.tsx` — add route
- `src/components/layout/Sidebar.tsx` — add Merch nav link
- Database migration — create `merch_orders` table

