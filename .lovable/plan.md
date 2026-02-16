
## Add "Received Tokens" Ledger Tab to Migration Page

### Overview
Create a new "Received" tab in the Migrate section that shows an accurate, on-chain-verified ledger of all token transfers received by the collection wallet. This tab will be the source of truth for distributing new tokens.

### What It Does
- New edge function (`scan-collection-wallet`) calls Helius to fetch ALL token transfer history for the collection wallet, filtered to the old $TUNA mint
- Aggregates transfers by sender wallet: total tokens, number of transactions, first/last transfer timestamps
- Stores results in a new `tuna_migration_ledger` database table
- New "Received" tab on /migrate shows this data with statistics and a Refresh button

### Database Changes

**New table: `tuna_migration_ledger`**
- `id` (uuid, PK)
- `wallet_address` (text, unique) -- sender address
- `total_tokens_received` (numeric) -- aggregated total
- `tx_count` (integer) -- number of separate transfers
- `first_transfer_at` (timestamptz) -- earliest transaction timestamp
- `last_transfer_at` (timestamptz) -- latest transaction timestamp
- `last_scanned_at` (timestamptz) -- when this record was last updated by the scanner
- `created_at` (timestamptz)

RLS: public read access (no auth needed for viewing), no public writes.

### New Edge Function: `scan-collection-wallet`

1. Calls Helius Enhanced Transactions API to get ALL transactions involving the collection wallet
2. Filters for old $TUNA mint token transfers TO the collection wallet
3. Groups by sender wallet, sums amounts, counts transactions, tracks timestamps
4. Upserts results into `tuna_migration_ledger` table
5. Returns summary statistics

Uses existing `HELIUS_API_KEY` secret.

### UI Changes (MigratePage.tsx)

**New "Received" tab** added alongside "Snapshot Holders" and "Migrated":

**Top Stats Cards:**
- Total Tokens Received (with % of total supply)
- Unique Senders
- Total Transactions
- Last Scanned timestamp

**Refresh Button:** Calls the edge function to re-scan on-chain data and updates the table

**Table Columns:**
- Wallet (truncated + copy button)
- Tokens Received (formatted number)
- % of Supply
- TX Count
- First Transfer (date/time)
- Last Transfer (date/time)
- Solscan link

Sorted by tokens received descending.

### Technical Details

**Edge function flow:**
```text
User clicks Refresh
  -> POST /scan-collection-wallet
  -> Helius: fetch all transactions for collection wallet
  -> Filter: only old TUNA mint transfers TO collection wallet
  -> Aggregate by sender: sum amounts, count txs, min/max timestamps
  -> Upsert into tuna_migration_ledger
  -> Return summary + full list
```

**Helius API used:** Enhanced Transaction History (`/v0/addresses/{address}/transactions`) with pagination to get complete history.

**Files to create:**
- `supabase/functions/scan-collection-wallet/index.ts`

**Files to modify:**
- `src/pages/MigratePage.tsx` (add Received tab, refresh button, stats)

**Database migration:**
- Create `tuna_migration_ledger` table with RLS policies
