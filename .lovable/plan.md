

# Plan: /sellall Page — Bulk Sell All Tokens from Wallet

## Overview
Create a new edge function `bulk-sell-tokens` that signs and sends sell transactions server-side using a private key you provide as a secret. Then create a simple `/sellall` page that calls it and shows progress.

## Step 1: Add Secret
- Add `BULK_SELL_PRIVATE_KEY` — you'll input the base58 private key for `EoKWXs7yrwTaGgKdtZbB9QFQDgPDm28Yr8EsjKcx2r6a`

## Step 2: Create Edge Function `bulk-sell-tokens/index.ts`
- Accepts `{ adminPassword, slippage?, dryRun? }`
- Hardcodes wallet address `EoKWXs7yrwTaGgKdtZbB9QFQDgPDm28Yr8EsjKcx2r6a`
- Loads private key from `BULK_SELL_PRIVATE_KEY` secret
- Fetches all SPL token accounts via RPC (`getTokenAccountsByOwner`) using existing `HELIUS_RPC_URL` or `ALCHEMY_SOLANA_RPC_URL`
- Filters out WSOL and zero-balance tokens
- For each token with balance > 0:
  - First tries **PumpPortal** sell (action: "sell", amount as token balance, denominatedInSol: "false", slippage: 25%)
  - If PumpPortal fails (token graduated/not on pump), falls back to **Jupiter** swap to SOL
  - Signs the transaction with the private key using `@solana/web3.js`
  - Sends via RPC `sendTransaction`
  - Waits 2s between sells to avoid rate limits
- Returns results array: `{ mint, balance, status, signature?, error? }`
- `dryRun: true` just lists holdings without selling
- Protected by admin password (`saturn135@`)

## Step 3: Create Page `src/pages/SellAllPage.tsx`
- Simple dark-themed page matching existing style
- Shows "Scan Holdings" button → calls edge function with `dryRun: true`
- Displays list of all tokens found with balances
- "Sell All" button → calls edge function without dryRun
- Real-time progress display: each token row shows pending/success/error status
- Admin password input field (pre-filled or from localStorage)

## Step 4: Add Route
- Add `/sellall` route in `App.tsx` pointing to `SellAllPage`

## Technical Notes
- Reuses existing patterns from `trading-agent-force-sell` (Jupiter quotes, Jito bundles, slippage escalation)
- PumpPortal API returns raw tx bytes → deserialize → sign with Keypair → send
- Jupiter fallback handles graduated tokens that left pump.fun bonding curve
- No Privy integration needed — direct Keypair signing from the secret

