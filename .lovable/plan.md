

# Compressed Token Distribution Test Page

## Goal
Build a new admin page at `/admin/compressed-distribute` to test ZK Compressed token transfers using Light Protocol. This page lets you enter up to 100 wallet addresses, a token mint, and an amount -- then distributes compressed tokens in batches and reports actual costs.

## How It Works

Compressed tokens use ZK Compression (Light Protocol) to store token accounts in Merkle trees instead of individual on-chain accounts. This eliminates the ~0.002 SOL rent per recipient, reducing costs by ~99%.

**Cost comparison for 100 wallets:**
- Normal SPL transfer: ~0.204 SOL (rent) + ~0.0005 SOL (fees) = ~0.205 SOL
- Compressed token transfer: ~0.005 SOL total (just tx fees + state tree writes)

## What Gets Built

### 1. New Edge Function: `compressed-distribute`
- Accepts: source private key (bs58), token mint address, list of destination wallets, amount per wallet
- Uses `@lightprotocol/compressed-token` and `@lightprotocol/stateless.js` via esm.sh
- Steps:
  1. Connect via `createRpc()` using Helius RPC (Helius supports ZK Compression natively)
  2. Check if the mint has a compressed token pool -- if not, create one via `createTokenPool()`
  3. Compress source tokens if they're in a normal SPL ATA (using `compress()`)
  4. Batch transfer compressed tokens to destinations using `transferInterface()` -- up to ~20 per transaction
  5. Track SOL spent on fees (before/after balance diff) and return detailed results
- Returns: per-batch signatures, total SOL cost, cost per recipient, success/failure counts

### 2. New Page: `CompressedDistributePage.tsx`
- Same admin password gate as the tunnel page ("tuna")
- Form inputs:
  - Source wallet private key (bs58)
  - Token mint address
  - Amount per wallet (token amount, respecting decimals)
  - Destination wallets textarea (one per line, max 100)
- "Start Distribution" button
- Real-time console log panel (same style as tunnel page)
- Results summary: total cost in SOL, cost per recipient, batch signatures
- All state persisted in localStorage (same pattern as tunnel page)

### 3. Route Registration
- Add lazy import and route `/admin/compressed-distribute` in `App.tsx`

## Technical Details

### Edge Function: `supabase/functions/compressed-distribute/index.ts`

The function will use these esm.sh imports:
```
@lightprotocol/stateless.js (createRpc, confirmTx)
@lightprotocol/compressed-token (createTokenPool, compress, transfer/transferInterface, mintTo)
@solana/web3.js (Keypair, PublicKey, Connection, LAMPORTS_PER_SOL)
@solana/spl-token (getAssociatedTokenAddress, getAccount)
bs58
```

Flow:
1. Parse inputs, decode source keypair
2. Create `rpc` via `createRpc(HELIUS_RPC_URL)` -- Helius natively supports ZK Compression RPC methods
3. Record starting SOL balance of source wallet
4. Check if token pool exists for the mint; create if needed
5. Check source's compressed token balance; if insufficient, compress from SPL ATA
6. Batch destinations into groups of 20
7. For each batch, call `transfer()` for each recipient (compressed token transfer)
8. Record ending SOL balance
9. Return cost breakdown and all signatures

### Frontend Page

Mirrors the tunnel distribute page structure:
- Password gate with localStorage persistence
- Form with localStorage persistence for all fields
- Console log panel with color-coded entries
- Stats cards showing: Total Wallets, Success, Failed, Total Cost (SOL), Cost Per Wallet
- Results table with batch number, wallet addresses, status, and transaction links

### Important Notes
- Helius paid tier (which you already have) supports ZK Compression RPC endpoints natively
- No new secrets needed -- uses existing `HELIUS_RPC_URL`
- The source wallet needs to hold the SPL tokens to compress and distribute, plus a small amount of SOL for fees
- First run may cost slightly more due to token pool creation (one-time ~0.003 SOL)

