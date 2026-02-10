
# Complete Claw Mode Isolation + Admin Launch + Bidding System

## Overview
This plan covers three major areas:
1. **Missing backend functions** for full Claw Mode isolation (fee claiming, distribution, token creation, idea generation)
2. **Admin-only token launch panel** with AI idea generation for Claw Mode
3. **Agent bidding system** where users can bid on launched agents within a 6-hour window and take full ownership

---

## Part 1: Missing Edge Functions for Full Isolation

### 1A. `claw-trading-create` (mirrors `trading-agent-create`)
- Creates trading agents in `claw_trading_agents` + `claw_agents`
- Launches tokens into `claw_tokens` (NOT `fun_tokens`)
- Uses `claw_deployer_wallets` for deployment
- Creates SubClaw community in `claw_communities`
- Generates encrypted trading wallet
- Calls Vercel API for on-chain token launch (same Meteora infrastructure)
- **Shares**: `API_ENCRYPTION_KEY`, `METEORA_API_URL`, `LOVABLE_API_KEY`

### 1B. `claw-trading-generate` (mirrors `trading-agent-generate`)
- AI-powered identity generation for Claw trading agents
- Generates name, ticker, description, personality, avatar
- Uses lobster/claw theming instead of tuna theming in prompts
- Uploads avatars to a `claw-trading-agents` storage bucket

### 1C. `claw-idea-generate` (mirrors `agent-idea-generate`)
- AI-powered token concept generator with lobster/claw branding
- Generates name, ticker, description, image, tweet text
- Uses lobster mascot instead of tuna sushi mascot in image prompts
- Returns claw-themed concepts

### 1D. `claw-claim-fees` (mirrors `fun-claim-fees`)
- Cron job that claims trading fees from Claw token pools
- Queries `claw_tokens` (NOT `fun_tokens`)
- Records claims in `claw_fee_claims` (NOT `fun_fee_claims`)
- Uses **`CLAW_TREASURY_PRIVATE_KEY`** (NEW SECRET REQUIRED)
- Calls same Meteora API to claim from pools

### 1E. `claw-distribute` (mirrors `fun-distribute`)
- Distributes claimed fees from `claw_fee_claims`
- Routes to agent wallets (80/20 split) or trading agent wallets (50/50)
- Records in `claw_agent_fee_distributions`
- Uses **`CLAW_TREASURY_PRIVATE_KEY`** for sending SOL
- No partner split logic (Claw is independent)

### 1F. `claw-creator-claim` (mirrors `agent-creator-claim`)
- Allows creators to claim their earned fees from Claw tokens
- Queries `claw_fee_claims` and `claw_agent_fee_distributions`
- Uses **`CLAW_TREASURY_PRIVATE_KEY`** for payouts
- 1-hour cooldown per user

---

## Part 2: New Secret Required

**`CLAW_TREASURY_PRIVATE_KEY`** -- A brand new wallet that acts as the Claw Mode treasury. This wallet will:
- Receive all claimed fees from Claw token pools
- Distribute creator/agent shares
- Handle creator claim payouts

You will need to generate a new Solana wallet and provide its private key as this secret.

---

## Part 3: Database Additions

### New Tables
| Table | Purpose |
|-------|---------|
| `claw_distributions` | Records fee distributions (mirrors `fun_distributions`) |
| `claw_creator_claim_locks` | Atomic locking for double-claim prevention |
| `claw_agent_bids` | **NEW** - Stores bids on agents during 6-hour auction |

### New RPC Functions
- `acquire_claw_creator_claim_lock(p_twitter_username, p_duration_seconds)` -- atomic lock
- `release_claw_creator_claim_lock(p_twitter_username)` -- release lock

### `claw_agent_bids` Schema
```text
id              UUID PRIMARY KEY
claw_agent_id   UUID REFERENCES claw_agents(id)
trading_agent_id UUID REFERENCES claw_trading_agents(id)
bidder_wallet   TEXT NOT NULL
bid_amount_sol  NUMERIC NOT NULL
status          TEXT DEFAULT 'active'  (active / won / outbid / expired)
created_at      TIMESTAMPTZ DEFAULT now()
expires_at      TIMESTAMPTZ  (set to agent launch_time + 6 hours)
```

### Modify `claw_trading_agents`
- Add column: `launched_at TIMESTAMPTZ` -- when token was launched (bidding starts)
- Add column: `bidding_ends_at TIMESTAMPTZ` -- launch + 6 hours
- Add column: `owner_wallet TEXT` -- current owner (starts as admin, transfers on bid win)
- Add column: `is_owned BOOLEAN DEFAULT false` -- whether someone purchased it
- Add column: `ownership_transferred_at TIMESTAMPTZ`

---

## Part 4: Admin-Only Launch Panel

### New Component: `ClawAdminLaunchPanel.tsx`
- Only visible to admins (uses `useIsAdmin` hook)
- Three launch modes:
  1. **AI Generate** -- calls `claw-idea-generate` for random lobster-themed concepts, then launches
  2. **AI Trading Agent** -- calls `claw-trading-generate` for trading agent identity, then `claw-trading-create`
  3. **Custom** -- manual name/ticker/description/image form
- All launches go through `claw-trading-create` which writes to `claw_tokens`
- Password gate removed (replaced by wallet-based admin check)
- Generate button produces AI name + avatar + description with claw branding

### New Hook: `useClawAdminLaunch`
- Calls `claw-trading-create` edge function
- Returns launch status, created agent data

### New Hook: `useClawIdeaGenerate`
- Calls `claw-idea-generate` edge function
- Returns generated concept (name, ticker, description, imageUrl)

### Updated: `ClawTradingSection.tsx`
- Replace password-gated "Create Agent" card with admin-only panel
- Show `ClawAdminLaunchPanel` only when `isAdmin === true`
- Remove beta password logic entirely

---

## Part 5: User Bidding System

### How It Works
1. Admin launches a new agent via Claw Admin Panel
2. `claw-trading-create` sets `launched_at = now()` and `bidding_ends_at = now() + 6h`
3. Agent card shows a "BID" button with countdown timer
4. Users can place bids (SOL amount) during the 6-hour window
5. Each new bid must be higher than the current highest bid
6. When bidding ends, highest bidder wins ownership
7. Winner's wallet becomes the `owner_wallet` on the trading agent
8. Owner receives all future fee distributions for that agent

### New Edge Function: `claw-agent-bid`
- POST: Place a bid
  - Validates bidding window is still open
  - Validates bid is higher than current highest
  - Records bid in `claw_agent_bids`
  - Marks previous highest bid as "outbid"
- GET: Check current bid status for an agent

### New Edge Function: `claw-agent-bid-settle`
- Cron job that runs every 5 minutes
- Finds agents where `bidding_ends_at < now()` and `is_owned = false`
- For each: finds highest bid, transfers ownership
- Updates `claw_trading_agents.owner_wallet`, `is_owned = true`
- Marks winning bid as "won", all others as "expired"
- SOL from winning bid goes to Claw treasury

### New Frontend Components

**`ClawBidCard.tsx`**
- Shows on each agent card when bidding is active
- Countdown timer (6h from launch)
- Current highest bid display
- Bid input + "Place Bid" button
- Connected wallet required

**`ClawBidModal.tsx`**
- Full bidding interface in a modal
- Shows bid history
- Real-time countdown
- Wallet balance check before bidding

### New Hooks
- `useClawAgentBid` -- place bids, check bid status
- `useClawBidCountdown` -- countdown timer for bidding window

### Updated: `ClawTradingSection.tsx`
- Agent cards show bid status: "Bidding Open (Xh Ym left)" or "Owned by [wallet]"
- Filter tab: add "Bidding" tab showing agents currently in auction
- Owned agents show owner badge

---

## Part 6: Frontend Hook Updates

### New Hooks Summary
| Hook | Purpose |
|------|---------|
| `useClawAdminLaunch` | Admin token/agent launch |
| `useClawIdeaGenerate` | AI concept generation |
| `useClawAgentBid` | Place and check bids |
| `useClawBidCountdown` | Countdown timer |
| `useClawCreatorClaim` | Creator fee claiming |

---

## Part 7: Config Updates

### `supabase/config.toml` additions
```text
[functions.claw-trading-create]
verify_jwt = false

[functions.claw-trading-generate]
verify_jwt = false

[functions.claw-idea-generate]
verify_jwt = false

[functions.claw-claim-fees]
verify_jwt = false

[functions.claw-distribute]
verify_jwt = false

[functions.claw-creator-claim]
verify_jwt = false

[functions.claw-agent-bid]
verify_jwt = false

[functions.claw-agent-bid-settle]
verify_jwt = false
```

---

## Implementation Order

1. **Ask for `CLAW_TREASURY_PRIVATE_KEY` secret** -- required before fee functions work
2. **Database migration** -- add `claw_distributions`, `claw_creator_claim_locks`, `claw_agent_bids` tables + modify `claw_trading_agents` with bidding columns + RPC functions
3. **Edge functions (batch 1)**: `claw-trading-create`, `claw-trading-generate`, `claw-idea-generate`
4. **Edge functions (batch 2)**: `claw-claim-fees`, `claw-distribute`, `claw-creator-claim`
5. **Edge functions (batch 3)**: `claw-agent-bid`, `claw-agent-bid-settle`
6. **Frontend hooks**: all new hooks
7. **Frontend components**: `ClawAdminLaunchPanel`, `ClawBidCard`, `ClawBidModal`
8. **Update `ClawTradingSection`**: integrate admin panel + bidding UI

---

## Complete System Flow

```text
ADMIN LAUNCHES AGENT
        |
        v
claw-trading-create
  -> claw_agents (insert)
  -> claw_trading_agents (insert, bidding_ends_at = +6h)
  -> claw_tokens (insert)
  -> claw_communities (insert)
  -> On-chain: Meteora DBC pool created
        |
        v
BIDDING WINDOW (6 hours)
  -> Users place bids via claw-agent-bid
  -> claw_agent_bids (insert, must beat current highest)
  -> Countdown shown on agent cards
        |
        v
BIDDING SETTLES (claw-agent-bid-settle cron)
  -> Highest bidder wins
  -> owner_wallet updated on claw_trading_agents
  -> Bid SOL sent to Claw treasury
        |
        v
FEE FLOW (ongoing)
  -> claw-claim-fees (cron) claims from pools -> claw_fee_claims
  -> claw-distribute (cron) sends 80% to owner_wallet
  -> Owner can also claim via claw-creator-claim
```
