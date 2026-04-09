

# Plan: Bulk Sell All Memecoins from Wallet

## Overview
Create an edge function `bulk-sell-tokens` that:
1. Fetches all token holdings from wallet `EoKWXs7yrwTaGgKdtZbB9QFQDgPDm28Yr8EsjKcx2r6a`
2. For each token with balance > 0, builds a sell transaction via PumpPortal API
3. Signs each transaction using the wallet's private key (which you'll provide as a secret)
4. Sends transactions one-by-one with a delay to avoid rate limits
5. Returns a summary of all sells (successes/failures)

## Steps

### 1. Add wallet private key as a secret
- Add secret `BULK_SELL_PRIVATE_KEY` — you'll input the base58 private key for `EoKWXs7yrwTaGgKdtZbB9QFQDgPDm28Yr8EsjKcx2r6a`

### 2. Create edge function `bulk-sell-tokens/index.ts`
The function will:
- Accept POST with `{ adminPassword, walletAddress, slippage?, dryRun? }`
- Require admin password for security
- Fetch all SPL token accounts via Helius RPC (`getTokenAccountsByOwner`)
- Filter to tokens with balance > 0
- For each token:
  - Call PumpPortal `trade-local` API with `action: "sell"`, `denominatedInSol: "false"`, `amount: 100` (100% of holdings)
  - Deserialize the returned transaction bytes
  - Sign with the private key
  - Send via Helius RPC `sendTransaction`
  - Wait 2 seconds between sells to avoid rate limits
  - Log success/failure per token
- Return JSON array of results: `{ mint, balance, signature?, error? }`
- Support `dryRun: true` to just list holdings without selling

### 3. Deploy and test
- Deploy the function
- First call with `dryRun: true` to see all 50 tokens
- Then call without dryRun to execute sells

## Technical Details
- Uses `@solana/web3.js` for signing (imported via esm.sh in Deno)
- PumpPortal's `amount: 100` with `denominatedInSol: "false"` sells 100% of token balance
- Slippage default: 25% (pumpswap tokens can be illiquid)
- Priority fee: 0.001 SOL per tx
- Tokens that fail PumpPortal (not on pump.fun) will be skipped with error logged — those may need Jupiter instead

## Fallback
Some tokens may have migrated off pump.fun bonding curves. For those, the function will attempt a Jupiter swap as fallback (using the existing `jupiter-proxy` edge function pattern).

