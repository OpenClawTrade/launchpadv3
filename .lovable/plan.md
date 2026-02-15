
# Tunnel Wallet Distribution Tool

## Overview
A hidden admin page at `/admin/tunnel-distribute` that lets you fund multiple destination wallets through intermediate "tunnel" wallets to avoid Bubblemaps clustering detection. Password-protected, with full console logging in the UI.

## How It Works

```text
  Source Wallet (you fund this)
        |
        +---> Tunnel Wallet A (auto-generated) --[1-5 min delay]--> Dest Wallet 1
        |                                      --[1-5 min delay]--> Dest Wallet 2
        |                                      ...
        +---> Tunnel Wallet B (auto-generated) --[1-5 min delay]--> Dest Wallet 3
        |                                      --[1-5 min delay]--> Dest Wallet 4
        |                                      ...
```

Each destination wallet gets routed through one of 2 tunnel wallets. Tunnel wallets are freshly generated keypairs. Every hop has a randomized 5-10 minute delay between sends to look organic.

## Components

### 1. Frontend Page: `src/pages/TunnelDistributePage.tsx`
- Password gate (same `tuna2024treasury` pattern as other admin pages)
- Input fields:
  - Source wallet private key (bs58) - the wallet you pre-fund
  - SOL amount per destination (e.g. 0.005)
  - Textarea for destination wallets (one per line, 20-30 wallets)
- "Start Distribution" button
- Real-time console log panel showing every step with timestamps:
  - Tunnel wallet generation (public + private keys saved to display)
  - Each transfer with signature links
  - Delays between transfers
  - Errors with full detail
- Status cards: total wallets, processed, pending, failed
- Table of all tunnel wallet keys (so you can recover funds if stuck)

### 2. Edge Function: `supabase/functions/tunnel-distribute/index.ts`
- Receives: source private key, destination wallets, amount per wallet
- Process:
  1. Generate 2 fresh tunnel keypairs
  2. Split destinations evenly between the 2 tunnels
  3. Fund each tunnel wallet from source (enough SOL for its batch + fees)
  4. Return tunnel keys + assignment plan to frontend
- The frontend then calls a second edge function for each individual hop

### 3. Edge Function: `supabase/functions/tunnel-send/index.ts`
- Receives: tunnel wallet private key, destination address, lamports amount
- Executes a single SOL transfer from tunnel to destination
- Returns signature or error
- Frontend orchestrates the timing (delays between calls)

### 4. Database Table: `tunnel_distribution_runs`
- Tracks each run: source wallet, status, created_at
- Stores tunnel keypairs (encrypted) so keys are never lost
- Records each hop: tunnel -> destination, amount, signature, status

### 5. Route Registration in `App.tsx`
- Add lazy-loaded route at `/admin/tunnel-distribute`
- Not linked from any navigation menu

## Frontend Orchestration Flow
1. User enters source key + destinations + amount, clicks Start
2. Frontend calls `tunnel-distribute` to generate tunnels and fund them
3. Frontend receives tunnel assignments
4. Frontend loops through each destination with random 5-10 min delay:
   - Calls `tunnel-send` for each hop
   - Logs every step in the UI console
   - Saves all keys in a visible table
5. If any transfer fails, it logs the error and continues with the next wallet
6. At the end, shows summary with all signatures

## Security
- Password-gated UI (same pattern as Treasury/Deployer admin pages)
- Edge functions validate admin secret server-side via `TWITTER_BOT_ADMIN_SECRET`
- Private keys transmitted over HTTPS only, never stored in localStorage
- Tunnel keypairs saved to database (encrypted) as backup

## Technical Details
- Uses `@solana/web3.js` via `esm.sh` in edge functions (same as existing functions)
- RPC via `HELIUS_RPC_URL` secret (already configured)
- Micro transactions: configurable amount, default ~0.005 SOL per destination
- Each tunnel gets: `(batch_size * amount) + (batch_size * 0.000005)` for rent/fees
- Delay orchestration happens client-side using `setTimeout`/`setInterval` with progress tracking
