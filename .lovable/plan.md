

# NFA Season One -- Complete Execution Plan

## What Exists Today

- `nfa_batches` table (id, batch_number, total_slots, minted_count, status)
- `nfa_mints` table (id, batch_id, slot_number, minter_wallet, payment_signature, payment_verified, nfa_mint_address, agent_name, agent_image_url, agent_personality, status)
- `nfa-mint` edge function: verifies 1 SOL payment on-chain, inserts DB record -- but does NOT mint an actual NFT
- `PanelNfaTab.tsx`: UI with hero, mint button, My NFAs grid, How It Works, Fee Structure tabs
- Secrets available: `TREASURY_PRIVATE_KEY`, `HELIUS_API_KEY`, `HELIUS_RPC_URL`, `LOVABLE_API_KEY`

## What This Plan Adds

1. Real Metaplex Core NFT minting on Solana
2. Customize-before-mint flow (name, ticker, image via AI or upload)
3. Public `/nfa` collection page (OpenSea-quality)
4. Public `/nfa/marketplace` page with buy/sell
5. On-chain NFT transfers on marketplace sale

---

## Phase 1: Database Migration

### 1A. Add columns to `nfa_mints`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| token_name | TEXT | null | User-chosen token name |
| token_ticker | TEXT | null | User-chosen ticker |
| token_image_url | TEXT | null | Final hosted image URL |
| metadata_locked | BOOLEAN | false | True after payment |
| owner_wallet | TEXT | null | Current owner (changes on sale) |
| listed_for_sale | BOOLEAN | false | Marketplace flag |
| listing_price_sol | NUMERIC | null | Current asking price |

Backfill: `UPDATE nfa_mints SET owner_wallet = minter_wallet WHERE owner_wallet IS NULL`

### 1B. Create `nfa_listings` table

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID PK | |
| nfa_mint_id | UUID FK | References nfa_mints.id |
| seller_wallet | TEXT | Seller's address |
| asking_price_sol | NUMERIC | Price in SOL |
| status | TEXT | active / sold / cancelled |
| buyer_wallet | TEXT | Buyer (on sale) |
| sale_signature | TEXT | On-chain tx sig |
| listed_at | TIMESTAMPTZ | When listed |
| sold_at | TIMESTAMPTZ | When sold |

RLS: Public read. Writes via service role only (edge functions).

### 1C. Enable realtime on `nfa_mints`, `nfa_batches`, `nfa_listings`

---

## Phase 2: Collection Setup (One-Time Admin)

### 2A. `nfa-create-collection` edge function

Creates a single Metaplex Core Collection asset on-chain using the treasury keypair. This is called once by an admin.

**Libraries used (imported via esm.sh in Deno):**
- `@metaplex-foundation/umi` -- Metaplex universal interface
- `@metaplex-foundation/umi-bundle-defaults` -- Default plugins (RPC, serializers)
- `@metaplex-foundation/mpl-core` -- Core NFT standard (single-account, cheapest on Solana)

**What it does:**
1. Loads `TREASURY_PRIVATE_KEY` to create a Umi keypair signer
2. Connects to Helius RPC via Umi
3. Calls `createCollection()` from mpl-core with collection metadata (name: "Non-Fungible Agents", URI pointing to collection JSON)
4. Returns the collection public key
5. This address is stored as `NFA_COLLECTION_ADDRESS` secret for use by the mint function

---

## Phase 3: Upgrade `nfa-mint` -- Real NFT Minting + Metadata

### Current flow (keeps working):
1. User pays 1 SOL to treasury
2. Edge function verifies payment on-chain via Helius
3. Checks for duplicate signatures
4. Inserts DB record

### New additions after payment verification:

5. Validate `tokenName` (1-32 chars), `tokenTicker` (1-10 chars, `/^[A-Z0-9.]+$/`), `tokenImageUrl` (valid URL)
6. Load treasury keypair as Umi signer
7. Call `create()` from mpl-core to mint a Core NFT asset:
   - Owner: minter's wallet (the NFT goes directly to them)
   - Collection: `NFA_COLLECTION_ADDRESS`
   - Name: "NFA #[slot]"
   - URI: metadata JSON URL (hosted on storage)
   - Plugins: Transfer Delegate set to treasury (enables marketplace transfers later)
8. Store `nfa_mint_address` (the on-chain asset address) in the DB
9. Store `token_name`, `token_ticker`, `token_image_url`, set `metadata_locked = true`, `owner_wallet = minterWallet`

### NFT Metadata JSON (uploaded to storage before minting):
```
{
  "name": "NFA #42",
  "description": "Non-Fungible Agent #42 on Solana",
  "image": "<user-chosen-image-url>",
  "external_url": "https://clawmode.fun/nfa/42",
  "attributes": [
    { "trait_type": "Token Name", "value": "UserChosenName" },
    { "trait_type": "Ticker", "value": "TICKER" },
    { "trait_type": "Slot", "value": 42 },
    { "trait_type": "Batch", "value": 1 }
  ]
}
```

---

## Phase 4: `nfa-generate-image` Edge Function

New edge function for AI-powered image generation.

- Uses Lovable AI gateway (`google/gemini-2.5-flash-image` model via `LOVABLE_API_KEY`)
- Accepts: `{ tokenName, tokenTicker }` (optional, for themed prompts)
- Generates a themed agent avatar image
- Uploads the result to the `post-images` storage bucket
- Returns: `{ imageUrl: "https://...public-url..." }`
- No large base64 round-trips -- image is stored server-side

---

## Phase 5: Frontend -- Customize-Then-Mint Flow

### Update `PanelNfaTab.tsx`

Replace the single "MINT NFA" button with a multi-step flow:

**Step 1: Customize**
- Token Name input (max 32 chars)
- Ticker input (max 10 chars, auto-uppercase)
- Image section with two buttons:
  - "Generate with AI" -- calls `nfa-generate-image`, shows spinner, displays result
  - "Upload Image" -- file picker (PNG/JPG/WebP, max 2MB), uploads to storage
- Live preview card showing the NFA as it will look
- "Continue to Payment" button (disabled until all fields filled)

**Step 2: Confirm and Pay**
- Read-only preview of all metadata
- Warning: "This cannot be changed after minting"
- "MINT FOR 1 SOL" button triggers wallet payment (existing flow)
- "Back" button to edit

**Step 3: Done**
- Success screen with slot number, NFA card showing custom name/ticker/image
- "View My NFAs" link

---

## Phase 6: Public `/nfa` Collection Page

### Route: `/nfa` (public, no auth required to view)

**Sections:**
1. **Hero Banner** -- Full-width, NFA branding, collection avatar with verified badge
2. **Stats Bar** -- Items (1,000) | Minted | Floor Price | Owners
3. **Live Mint Section** -- Progress bar (X/1,000), "MINT FOR 1 SOL" CTA (requires wallet)
4. **About + Details** -- Two-column cards (reuse existing components)
5. **Collection Grid** -- All minted NFAs displayed as cards (image, name, ticker, slot, owner)
6. **Tabs** -- How It Works (timeline), Fee Structure (bars), Activity (recent mints)

### New files:
- `src/pages/NfaPage.tsx`
- `src/components/nfa/NfaHero.tsx`
- `src/components/nfa/NfaMintSection.tsx`
- `src/components/nfa/NfaCollectionGrid.tsx`
- `src/components/nfa/NfaStatsBar.tsx`
- `src/components/nfa/NfaActivityFeed.tsx`
- `src/hooks/useNfaCollection.ts`

---

## Phase 7: Marketplace Edge Functions

### 7A. `nfa-list` -- List NFA for sale
- Input: `nfaMintId`, `sellerWallet`, `askingPriceSol`
- Validates `owner_wallet` matches seller
- Verifies seller holds the NFT on-chain (optional check)
- Creates `nfa_listings` record with status `active`
- Sets `nfa_mints.listed_for_sale = true`, `listing_price_sol`

### 7B. `nfa-buy` -- Buy a listed NFA
- Input: `buyerWallet`, `listingId`, `paymentSignature`
- Verifies SOL transfer to seller on-chain (same Helius pattern)
- Uses Metaplex Core Transfer Delegate (set during mint) to transfer NFT from seller to buyer server-side
- Updates `nfa_listings.status = 'sold'`, `buyer_wallet`, `sale_signature`
- Updates `nfa_mints.owner_wallet = buyerWallet`, `listed_for_sale = false`

### 7C. `nfa-delist` -- Cancel a listing
- Validates ownership
- Sets listing to `cancelled`
- Clears `listed_for_sale` flag on `nfa_mints`

### On-chain transfer approach:
During mint, the NFT is created with a **Transfer Delegate plugin** pointing to the treasury keypair. When a marketplace sale happens, the `nfa-buy` edge function uses the treasury key to execute `transferV1()` from mpl-core, moving the NFT from seller to buyer without requiring the seller to sign again. This is the professional, fully on-chain approach.

---

## Phase 8: Public `/nfa/marketplace` Page

### Route: `/nfa/marketplace` (public)

**Sections:**
1. **Header** -- "NFA Marketplace" with stats (Listed, Floor Price, 24h Volume)
2. **Filters/Sort** -- Price low-high, high-low, recently listed; price range filter
3. **Listings Grid** -- Cards showing image, name, ticker, slot number, asking price, seller (truncated), "Buy" button
4. **Buy Modal** -- Shows NFA details + price, "Buy for X SOL" button, wallet approval, on-chain verification, success confirmation

### New files:
- `src/pages/NfaMarketplacePage.tsx`
- `src/components/nfa/NfaListingCard.tsx`
- `src/components/nfa/NfaBuyModal.tsx`
- `src/components/nfa/NfaListModal.tsx`
- `src/hooks/useNfaMarketplace.ts`

---

## Phase 9: Panel Integration

Enhance existing `PanelNfaTab.tsx` My NFAs grid:
- "List for Sale" button on each owned NFA card (opens price input modal)
- "Listed at X SOL" badge on listed items
- "Cancel Listing" button on listed items
- Link to view on marketplace

---

## Phase 10: Navigation + Routes

### Routes to add in `App.tsx`:
- `/nfa` -- NfaPage (public collection + mint)
- `/nfa/marketplace` -- NfaMarketplacePage

### Navigation:
- Add "NFA" link to main site nav/footer
- Sub-links within NFA section: Collection | Marketplace

---

## Complete File List

### New files to create:
```
supabase/functions/nfa-create-collection/index.ts
supabase/functions/nfa-generate-image/index.ts
supabase/functions/nfa-list/index.ts
supabase/functions/nfa-buy/index.ts
supabase/functions/nfa-delist/index.ts
src/pages/NfaPage.tsx
src/pages/NfaMarketplacePage.tsx
src/components/nfa/NfaHero.tsx
src/components/nfa/NfaMintSection.tsx
src/components/nfa/NfaCollectionGrid.tsx
src/components/nfa/NfaStatsBar.tsx
src/components/nfa/NfaActivityFeed.tsx
src/components/nfa/NfaListingCard.tsx
src/components/nfa/NfaBuyModal.tsx
src/components/nfa/NfaListModal.tsx
src/hooks/useNfaCollection.ts
src/hooks/useNfaMarketplace.ts
```

### Files to modify:
```
supabase/functions/nfa-mint/index.ts  (add Metaplex Core minting + metadata fields)
src/components/panel/PanelNfaTab.tsx  (customize-then-mint flow + list/delist)
src/App.tsx                           (add /nfa and /nfa/marketplace routes)
```

---

## Required Secrets

Already available:
- `TREASURY_PRIVATE_KEY` -- signs NFT mint + marketplace transfer transactions
- `HELIUS_API_KEY` / `HELIUS_RPC_URL` -- RPC access
- `LOVABLE_API_KEY` -- AI image generation

Need to add after collection creation:
- `NFA_COLLECTION_ADDRESS` -- the on-chain Metaplex Core Collection public key

---

## Execution Order

1. Database migration (new columns + nfa_listings table + RLS + realtime)
2. `nfa-create-collection` edge function (admin creates collection, store address as secret)
3. `nfa-generate-image` edge function (AI image generation)
4. Upgrade `nfa-mint` to mint real Metaplex Core NFTs + accept metadata
5. Update `PanelNfaTab.tsx` with customize-then-mint flow
6. Build `/nfa` public collection page
7. Build `nfa-list`, `nfa-buy`, `nfa-delist` edge functions
8. Build `/nfa/marketplace` page
9. Update Panel with list/delist controls
10. Add routes and navigation
11. End-to-end testing

