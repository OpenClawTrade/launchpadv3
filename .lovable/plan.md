
# Migration Form Simplification + X Announcement

## Changes Overview

### 1. Simplify the Migration Form (Frontend)

The current form asks for wallet address, amount sent, and TX signature. The new flow will be:

- **Keep**: Wallet address input (no connect wallet button needed)
- **Remove**: Amount sent field entirely
- **Change**: TX signature from optional to required -- this is the key input
- The backend function will parse the transaction on-chain using Helius to automatically extract the sender wallet and amount transferred

The form will only have two fields:
1. Your Wallet Address (the address you sent from)
2. Transaction Signature (required -- paste the TX hash of your transfer)

### 2. Create Edge Function: `verify-tuna-migration`

A new backend function that:
1. Receives the TX signature
2. Fetches the transaction from Helius RPC (`getTransaction` or Helius parsed transaction API)
3. Verifies the transaction sent old $TUNA tokens to the collection wallet (`9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe`)
4. Extracts the sender wallet address and the exact amount transferred
5. Validates the sender is in the snapshot table
6. Updates the migration record with the verified amount and TX signature

This replaces the current `submit_tuna_migration` RPC call with a more secure, automated approach.

### 3. Update Database Function

Replace `submit_tuna_migration` with a new function or update it to accept only `p_tx_signature` and `p_wallet_address`, with `p_amount_sent` being set by the verified edge function using the service role key.

### 4. X Announcement Post

Draft a concise announcement tweet for posting:

```
$TUNA is migrating to its own launchpad.

Why? Pump.fun fees don't cut it. TUNA needs proper infrastructure -- its own launchpad, fee distribution to holders, and a Trading Agent that rewards you for holding.

Check your wallet. Send your tokens. Get your new $TUNA.

Migrate now: tuna.fun/migrate
```

---

## Technical Details

### Edge Function: `supabase/functions/verify-tuna-migration/index.ts`

- Uses `HELIUS_API_KEY` (already configured) to fetch parsed transaction data
- Endpoint: `https://api.helius.xyz/v0/transactions/?api-key=...` for parsed transactions
- Validates: token mint matches old TUNA mint, destination is collection wallet
- Extracts: sender address, token amount from parsed token transfers
- Updates `tuna_migration_snapshot` via service role Supabase client

### Frontend Changes: `src/pages/MigratePage.tsx`

- Remove `amountSent` state and its input field
- Remove the "Connect" wallet button
- Make TX signature required (not optional)
- Change `handleSubmitMigration` to call the new edge function instead of the RPC
- Update form labels and instructions accordingly
- Update the "How to Migrate" steps to remove mention of amount

### Database Migration

- Create or replace `submit_tuna_migration` to work with the new edge function flow, accepting wallet + tx_signature + amount from the backend (service role only)
