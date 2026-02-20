

# Unified Claw Mode Panel + Non-Fungible Agent (NFA) System

## Overview

This plan consolidates all authenticated features (Portfolio, Earnings, Create Token, NFA minting, Trading Agents) into a single **Panel** page behind Privy login, adds the NFA minting system, and replaces all remaining tuna branding with Claw Mode.

---

## Part 1: Can a New Token Standard Be Created on Solana for NFAs?

**Short answer: No custom on-chain standard, but effectively yes via Metaplex Core.**

Solana does not allow arbitrary new token "standards" the way Ethereum does with ERC contracts. However, **Metaplex Core** (the latest NFT standard on Solana) lets you set the **symbol** field to `"NFA"` on each minted asset. This is what Solana explorers (Solscan, SolanaFM, Solana Explorer) display as the asset type. So your NFAs will show up as **NFA** not **NFT** on all explorers.

Additionally, the off-chain metadata JSON can include custom fields:
```text
{
  "name": "Agent #347",
  "symbol": "NFA",
  "description": "Non-Fungible Agent - Autonomous Trading AI",
  "image": "https://...",
  "attributes": [...],
  "properties": {
    "asset_type": "Non-Fungible Agent",
    "standard": "NFA-1",
    "batch": 1,
    "slot": 347
  }
}
```

This makes it discoverable and distinguishable from regular NFTs programmatically.

---

## Part 2: Unified Panel Architecture

### Current State (scattered pages)
- `/portfolio` -- holdings, requires auth
- `/earnings` -- fee claims, requires auth  
- `/?create=1` -- token creation modal
- `/agents/dashboard` -- agent management
- `/agents/trading` -- trading agents
- No NFA page exists

### New State (unified `/panel` route)

A single `/panel` page with tab navigation:

```text
+--------------------------------------------------+
|  CLAW MODE PANEL          [User Avatar] [Logout]  |
+--------------------------------------------------+
| Portfolio | Earnings | Create | NFAs | Agents     |
+--------------------------------------------------+
|                                                    |
|  (Active tab content)                              |
|                                                    |
+--------------------------------------------------+
```

- If user is not logged in, shows a centered login prompt using Privy
- All existing page logic moves into tab components

---

## Part 3: Tuna Logo Cleanup

Replace `tuna-logo.png` references with `claw-logo.png` in:

| File | Current | Change to |
|------|---------|-----------|
| `PrivyProviderWrapper.tsx` | `import tunaLogo from "@/assets/tuna-logo.png"` | `import clawLogo from "@/assets/claw-logo.png"` |
| `PortfolioPage.tsx` | `"/tuna-logo.png"` | `claw-logo.png` import |
| `EarningsPage.tsx` | `"/tuna-logo.png"` | `claw-logo.png` import |
| `ApiDashboardPage.tsx` | `"/tuna-logo.png"` | `claw-logo.png` import |
| `BagsAgentsPage.tsx` | `tunaLogo` import | `clawLogo` import |
| `CreateTradingAgentModal.tsx` | `tunaLogo` import | `clawLogo` import |
| `AgentIdeaGenerator.tsx` | `includeTunaLogo` | `includeClawLogo` |

---

## Part 4: Implementation Steps

### Step 1 -- Database migrations
Create two new tables:

**`nfa_batches`**
- `id` UUID PK
- `batch_number` INT UNIQUE
- `total_slots` INT DEFAULT 1000
- `minted_count` INT DEFAULT 0
- `status` TEXT DEFAULT 'open' (open/generating/active/completed)
- `mint_price_sol` NUMERIC DEFAULT 1.0
- `created_at`, `generation_started_at`, `generation_completed_at` timestamps

**`nfa_mints`**
- `id` UUID PK
- `batch_id` UUID FK -> nfa_batches
- `slot_number` INT
- `minter_wallet` TEXT NOT NULL
- `payment_signature` TEXT
- `payment_verified` BOOLEAN DEFAULT false
- `trading_agent_id` UUID (linked after generation)
- `nfa_mint_address` TEXT (Metaplex Core asset address)
- `agent_name` TEXT, `agent_image_url` TEXT, `agent_personality` TEXT
- `status` TEXT DEFAULT 'paid'
- `created_at` TIMESTAMP

RLS: Public read on both tables. Insert on `nfa_mints` restricted to service role (edge function handles payment verification).

### Step 2 -- Replace all tuna-logo references
Update the 7 files listed above to use `claw-logo.png`.

### Step 3 -- Create `/panel` page with tabs
New file: `src/pages/PanelPage.tsx`
- Uses `useAuth()` from Privy
- If not authenticated: shows Claw Mode branded login screen with `login()` button
- If authenticated: shows tabbed interface with:
  - **Portfolio** tab (extract from `PortfolioPage.tsx`)
  - **Earnings** tab (extract from `EarningsPage.tsx`)  
  - **Create Token** tab (launch form, currently in `FunLauncherPage`)
  - **NFAs** tab (new -- mint UI + my NFAs gallery)
  - **Agents** tab (links to agent dashboard/trading)

### Step 4 -- Add sidebar navigation
Update `Sidebar.tsx`:
- Add `{ to: "/panel", label: "Panel", icon: LayoutDashboard }` next to Create Token button
- Keep "Create Token" button but link to `/panel?tab=create`

### Step 5 -- Add route
Update `App.tsx`:
- Add `<Route path="/panel" element={<PanelPage />} />`
- Keep old routes (`/portfolio`, `/earnings`) as redirects to `/panel?tab=portfolio` etc.

### Step 6 -- NFA Mint UI (inside Panel NFAs tab)
- Shows current batch progress bar (e.g., 347/1000)
- "Mint NFA - 1 SOL" button
- On click: sends 1 SOL to treasury wallet, calls `nfa-mint` edge function with signature
- Shows user's minted NFAs with status badges

### Step 7 -- `nfa-mint` edge function
New file: `supabase/functions/nfa-mint/index.ts`
- Accepts `{ minterWallet, paymentSignature }`
- Verifies 1 SOL transfer to treasury via Helius RPC (`getTransaction`)
- Creates `nfa_mints` record
- Increments `nfa_batches.minted_count`
- If batch reaches 1000, sets status to `generating` (batch generation is a separate future step)

### Step 8 -- NFA batch generation (future phase)
- `nfa-generate-batch` edge function triggered when batch fills
- For each of 1000 slots: AI generates personality/image, creates trading agent, launches token, mints Metaplex Core asset with symbol "NFA", transfers to minter
- This is the most complex step and can be built incrementally

---

## Technical Details

### Metaplex Core NFA Minting (Edge Function)
The `nfa-generate-batch` function will use `@metaplex-foundation/mpl-core` via Umi:
```text
create(umi, {
  asset: generateSigner(umi),
  name: "Agent #347 - CryptoShark",
  symbol: "NFA",                    // <-- This is what shows on explorers
  uri: metadataJsonUri,
  owner: minterPublicKey,
})
```

### Fee Distribution for NFA Agent Tokens
The existing `fun-distribute` edge function will be extended to detect NFA-linked tokens and apply the custom split:
- 30% to NFA minter wallet (stored in `nfa_mints.minter_wallet`)
- 30% to top 500 holders
- 30% to agent trading wallet
- 10% to platform treasury

### Panel Component Structure
```text
src/pages/PanelPage.tsx
src/components/panel/
  PanelPortfolioTab.tsx    (extracted from PortfolioPage)
  PanelEarningsTab.tsx     (extracted from EarningsPage)
  PanelCreateTab.tsx       (token creation form)
  PanelNfaTab.tsx          (NFA minting + gallery)
  PanelAgentsTab.tsx       (agent overview)
  PanelLoginScreen.tsx     (unauthenticated state)
```

---

## Summary of Changes

| Area | Files Changed/Created |
|------|----------------------|
| Branding | 7 files updated (tuna -> claw logo) |
| Panel page | 7 new component files + 1 page |
| Sidebar | `Sidebar.tsx` updated |
| Routes | `App.tsx` updated |
| Database | 2 new tables via migration |
| Edge function | `nfa-mint/index.ts` new |
| Privy config | `PrivyProviderWrapper.tsx` logo fix |

