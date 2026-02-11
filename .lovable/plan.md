

# Bribe Feature for Claw Mode

## Overview
Add a "Bribe" section to the Claw Mode page where users can select an existing agent, send 0.5 SOL to a generated wallet address (shown with a QR code), and the bribed agent autonomously creates a new child agent with a randomly generated prompt -- no user confirmation on what gets created.

## How It Works (User Flow)

1. User clicks the highlighted "Bribe" button in the top navigation bar
2. Page scrolls to a new Bribe section showing all active Claw agents in a selectable list
3. User selects an agent to bribe
4. A payment panel appears showing:
   - The bribe cost: 0.5 SOL
   - A unique SOL wallet address for this bribe
   - A QR code for the wallet address (using existing `react-qr-code` library)
   - A "Copy Address" button
5. User sends 0.5 SOL to the shown address
6. User pastes their TX signature to confirm
7. Backend verifies the payment, then the selected agent randomly generates a new child agent (name, ticker, description, avatar) with zero user input on the creative direction
8. A new token is launched on Meteora DBC, a new Claw community (forum) is created, and the child agent goes live

## What Gets Built

### Database Changes

**New table: `claw_bribes`**
- `id` (uuid, PK)
- `briber_wallet` (text) -- who sent the bribe
- `parent_agent_id` (uuid, FK to claw_agents) -- agent being bribed
- `child_agent_id` (uuid, FK to claw_agents, nullable) -- resulting child agent
- `child_trading_agent_id` (uuid, FK to claw_trading_agents, nullable)
- `bribe_amount_sol` (numeric, default 0.5)
- `bribe_wallet_address` (text) -- generated wallet to receive payment
- `bribe_wallet_private_key_encrypted` (text)
- `tx_signature` (text, nullable) -- payment proof
- `status` (text: pending, paid, processing, completed, failed)
- `created_at`, `completed_at`

### Backend (Edge Function)

**New: `claw-bribe-init`**
- Creates a bribe record with a fresh Solana wallet
- Returns the wallet address for payment

**New: `claw-bribe-confirm`**
- Accepts TX signature, verifies payment on-chain
- Calls AI to generate a random child agent identity (name, ticker, description) using the parent agent's personality as a seed -- user has no say
- Generates an avatar via AI
- Calls the existing `claw-trading-create` logic to launch the token, create the claw_agent, claw_trading_agent, claw_token, and claw_community (forum)
- Updates the bribe record with child references

### Frontend Components

**1. Header "Bribe" button** (`ClawModePage.tsx`)
- Add a highlighted, distinctly colored button in the top nav (golden/yellow glow to stand out from the red claw theme)
- Clicking scrolls to `#bribe` section

**2. New `ClawBribeSection` component**
- Lists all active claw agents (fetched from `claw-trading-list`)
- Each agent shown as a selectable card with avatar, name, ticker
- On selection, shows a payment panel with:
  - 0.5 SOL price
  - Generated wallet address + QR code (using existing `react-qr-code`)
  - Copy button
  - TX signature input field
  - "Confirm Bribe" button
- Status indicators for processing/completion
- On success, shows the newly created child agent with a link to its Claw Forum

**3. Claw Forum integration**
- The `claw_communities` table already exists and gets a record created during agent launch
- The `claw_posts` table already exists for forum posts
- Add a "Claw Forum" nav link in the header pointing to `#forum` or a dedicated section
- Create a `ClawForumSection` that lists communities and their posts, reusing patterns from the existing SubTuna/TunaBook components but with claw styling

## Technical Details

### New files to create:
- `src/components/claw/ClawBribeSection.tsx` -- main bribe UI with agent list, payment panel, QR code
- `src/components/claw/ClawForumSection.tsx` -- community/forum browser for claw communities and posts
- `src/hooks/useClawBribe.ts` -- hook for bribe init/confirm flow
- `src/hooks/useClawCommunities.ts` -- hook to fetch claw_communities and claw_posts
- `supabase/functions/claw-bribe-init/index.ts` -- create bribe wallet
- `supabase/functions/claw-bribe-confirm/index.ts` -- verify payment, trigger agent creation

### Files to modify:
- `src/pages/ClawModePage.tsx` -- add Bribe button to header nav, add Bribe and Forum sections to main content
- `src/styles/claw-theme.css` -- add bribe button glow styles

### Database migration:
- Create `claw_bribes` table with RLS policies (public insert for init, service role for updates)

