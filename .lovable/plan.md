
# Token Promotion System - Implementation Plan

## Overview
This plan outlines a comprehensive token promotion system that allows users to pay 1 SOL to promote their tokens on the @BuildTuna X account. The system includes payment processing, automated Twitter posting, and visual distinction for promoted tokens.

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TOKEN PROMOTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User clicks "Promote"  ──►  Generate Payment Address  ──►  User sends 1 SOL
│          │                                                          │
│          ▼                                                          ▼
│   Show Payment Modal    ◄──────────  Monitor for payment  ◄────────┘
│          │                                                          │
│          ▼                                                          ▼
│   Payment Confirmed!    ──►  Post to @BuildTuna X  ──►  Mark token promoted
│          │                                                          │
│          ▼                                                          ▼
│   Gold border on token  ◄──  Show in "Promoted Tokens" tab (24h)  ──┘
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### 1. New Table: `token_promotions`
Stores all promotion records with payment tracking and expiration.

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `fun_token_id` | uuid | FK to fun_tokens |
| `promoter_wallet` | text | Wallet that initiated promotion |
| `payment_address` | text | Generated Solana address for payment |
| `payment_private_key` | text | Encrypted private key (for treasury transfer) |
| `amount_sol` | numeric | Amount required (1.0 SOL) |
| `status` | text | pending / paid / posted / expired / failed |
| `signature` | text | Payment transaction signature |
| `twitter_post_id` | text | ID of posted tweet |
| `created_at` | timestamptz | When promotion was requested |
| `paid_at` | timestamptz | When payment was confirmed |
| `posted_at` | timestamptz | When tweet was posted |
| `expires_at` | timestamptz | 24h after posting |

**RLS Policies:**
- Anyone can SELECT promotions (for displaying promoted status)
- No direct INSERT/UPDATE/DELETE (handled by backend functions)

---

## New Components

### 2. Frontend Components

#### A. Promote Button Component
**File:** `src/components/launchpad/PromoteButton.tsx`

A reusable button that appears:
- In the launch success popup
- On each token in the token list/table
- On the token detail page

Features:
- Shows "Promote" with a megaphone/star icon
- Disabled state if token is already promoted (within 24h)

#### B. Promote Modal Component
**File:** `src/components/launchpad/PromoteModal.tsx`

Dialog that shows:
1. Generated Solana payment address with copy button
2. QR code for easy mobile payment
3. "1 SOL" amount clearly displayed
4. Real-time payment status monitoring
5. Success state with link to the tweet
6. "Paid promotion" disclaimer

#### C. Token Detail Page Updates
Add "Promote This Token" button on the token detail page with the same modal flow.

---

## Backend Implementation

### 3. New Edge Functions

#### A. `promote-generate` - Generate Payment Address
**File:** `supabase/functions/promote-generate/index.ts`

Endpoint: POST
- Generates a new Solana keypair for receiving payment
- Stores promotion record in database with `pending` status
- Returns the public address to the frontend
- Sets a 1-hour expiration for the payment window

#### B. `promote-check` - Check Payment Status
**File:** `supabase/functions/promote-check/index.ts`

Endpoint: POST
- Called by frontend to check if payment was received
- Uses Helius RPC to verify SOL balance/transfer to payment address
- If paid: updates status to `paid`, triggers Twitter post

#### C. `promote-post` - Post to Twitter
**File:** `supabase/functions/promote-post/index.ts`

Endpoint: Internal (called by promote-check)
- Uses twitterapi.io to post promotional tweet
- Includes:
  - Token image (via image_url)
  - Token name and ticker
  - "PAID PROMOTION" disclosure
  - Link to token page
  - Relevant hashtags
- Updates promotion record with `twitter_post_id` and `posted_at`
- Sets `expires_at` to 24 hours from posting

#### D. `promote-cron` - Cleanup Cron Job
**File:** `supabase/functions/promote-cron/index.ts`

Runs every 10 minutes:
- Expires old pending promotions (>1 hour)
- Marks promotions as expired after 24h
- Transfers collected payments to treasury wallet

---

## UI Updates

### 4. Launch Success Popup Enhancement
**File:** `src/pages/FunLauncherPage.tsx`

Add "Promote" button alongside existing Solscan/Trade buttons:
```text
┌─────────────────────────────────────┐
│         Token Launched!             │
│    [Token Image] Name ($TICKER)     │
│    Contract: xxx...xxx [copy]       │
│                                     │
│  [Solscan]  [Trade Now]  [Promote]  │
└─────────────────────────────────────┘
```

### 5. Token Table/Card Enhancement
**Files:** `src/components/launchpad/TokenTable.tsx`, `src/components/launchpad/TokenCard.tsx`

For promoted tokens:
- Gold border/glow effect
- "PROMOTED" badge
- "Promote" button for non-promoted tokens (in actions column)

### 6. New "Promoted Tokens" Tab
**File:** `src/pages/FunLauncherPage.tsx`

Add new tab in the main navigation:
- Shows only tokens with active promotions (within 24h of posting)
- Sorted by most recently promoted
- Each token shows time remaining until promotion expires

---

## Technical Details

### 7. Twitter Integration (twitterapi.io)

The existing secrets are already configured:
- `TWITTERAPI_IO_KEY` - API key for twitterapi.io
- `X_ACCOUNT_USERNAME`, `X_ACCOUNT_EMAIL`, `X_ACCOUNT_PASSWORD` - @buildtuna credentials
- `TWITTER_PROXY` - Residential proxy to prevent rate limiting

**Tweet Format:**
```text
🚀 PROMOTED TOKEN: [Token Name] ($[TICKER])

[Description - first 100 chars]

📈 Trade now: [axiom.trade link]
📋 CA: [mint_address]

This is a paid promotion. DYOR.

#Solana #Memecoin #TUNA
```

With attached image from `token.image_url`

### 8. Payment Flow

1. User clicks "Promote"
2. Frontend calls `promote-generate` to get payment address
3. Modal shows address with copy button and QR code
4. User sends 1 SOL from their wallet
5. Frontend polls `promote-check` every 5 seconds
6. Once confirmed:
   - `promote-check` verifies balance >= 1 SOL
   - Calls `promote-post` to tweet
   - Updates promotion status
   - Returns success to frontend
7. Modal shows success with link to tweet
8. Token immediately gets gold border in lists

---

## Data Hook Updates

### 9. New Hook: `useTokenPromotions`
**File:** `src/hooks/useTokenPromotions.ts`

- Fetches active promotions
- Real-time subscription for promotion updates
- Used by TokenTable, TokenCard, and FunLauncherPage

### 10. Update `useFunTokens`
Modify to include promotion status join or compute it client-side.

---

## Step-by-Step Implementation Order

1. **Database Migration** - Create `token_promotions` table with RLS
2. **Edge Functions** - Build promote-generate, promote-check, promote-post
3. **PromoteModal Component** - Payment UI with address display
4. **PromoteButton Component** - Reusable promote trigger
5. **Update Success Popup** - Add Promote button after launch
6. **Update TokenTable/TokenCard** - Gold styling and Promote button
7. **Add "Promoted Tokens" Tab** - New tab in navigation
8. **Cron Job** - Expiration and cleanup logic
9. **Testing & Polish** - End-to-end testing

---

## Security Considerations

- Payment addresses are single-use ephemeral keypairs
- Private keys are encrypted before storage
- Backend validates payment amount (>= 1 SOL)
- RLS prevents direct database manipulation
- Twitter post includes "PAID PROMOTION" disclosure for compliance

---

## Estimated Components/Files

| Type | Count | Files |
|------|-------|-------|
| Database Migration | 1 | token_promotions table |
| Edge Functions | 4 | promote-generate, promote-check, promote-post, promote-cron |
| React Components | 2 | PromoteButton, PromoteModal |
| React Hooks | 1 | useTokenPromotions |
| Page Updates | 3 | FunLauncherPage, TokenTable, TokenCard |

