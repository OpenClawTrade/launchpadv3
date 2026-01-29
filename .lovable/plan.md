
# Treasury Fee Recovery Admin Page

## Overview

This plan creates an admin page to discover and claim fees from **all** Meteora DBC pools launched by the deployer wallet (`CHrrxJbF7N3A622z6ajftMgAjkcNpGqTo1vtFhkf4hmQ`), including those **not registered** in the database. This addresses the issue of unclaimed fees from 529+ tokens launched historically.

## Problem Statement

- The deployer wallet has launched 529+ tokens on-chain
- Only a few are registered in `fun_tokens` or `tokens` tables
- The existing `fun-claim-fees` cron only claims from database-registered tokens
- Significant SOL in unclaimed trading fees is being lost

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Treasury Fee Recovery System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐      │
│  │  Helius DAS API  │────▶│  Edge Function   │────▶│  Admin UI Page   │      │
│  │  (Token Discovery)│    │  (Pool Scanner)  │     │  (Claim All)     │      │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘      │
│           │                        │                        │                 │
│           ▼                        ▼                        ▼                 │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐      │
│  │ Get all mints    │     │ Derive DBC pool  │     │ Batch claim fees │      │
│  │ created by wallet│     │ for each mint    │     │ from all pools   │      │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘      │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. New Edge Function: `treasury-scan-pools`

Creates an edge function to discover all tokens minted by the deployer and derive their DBC pool addresses.

**Location**: `supabase/functions/treasury-scan-pools/index.ts`

**Functionality**:
- Uses Helius DAS API `searchAssets` to find all FungibleToken assets where deployer is the authority
- Derives DBC pool address for each mint using Meteora SDK `deriveDbcPoolAddress`
- Checks if pool exists on-chain via `getPool`
- Returns list of pools with claimable fees status
- Cross-references with database to identify "unregistered" pools

**Key API calls**:
- Helius `searchAssets` with `ownerAddress` (deployer) and `tokenType: "fungible"`
- Meteora SDK `deriveDbcPoolAddress(WSOL_MINT, baseMint, configPubkey)`
- Meteora SDK `client.state.getPoolFeeMetrics(poolAddress)`

### 2. New Edge Function: `treasury-claim-all`

Creates an edge function to claim fees from multiple pools in sequence.

**Location**: `supabase/functions/treasury-claim-all/index.ts`

**Functionality**:
- Accepts array of pool addresses
- Claims fees from each pool using treasury wallet
- Records claims in a new `treasury_fee_claims` table
- Returns summary of total claimed

### 3. Database Table: `treasury_fee_claims`

Tracks all fee claims from unregistered pools for audit purposes.

**Schema**:
```sql
CREATE TABLE treasury_fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL,
  mint_address TEXT,
  token_name TEXT,
  claimed_sol NUMERIC NOT NULL DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  is_registered BOOLEAN DEFAULT false -- whether token was in DB
);
```

### 4. New Admin Page: `TreasuryAdminPage.tsx`

Creates a password-protected admin page for treasury operations.

**Location**: `src/pages/TreasuryAdminPage.tsx`
**Route**: `/admin/treasury`

**Features**:
- Password authentication (stored in localStorage)
- "Scan Pools" button to discover all deployer pools
- Display of:
  - Total pools found
  - Registered vs unregistered breakdown
  - Per-pool claimable fees
  - Total claimable SOL
- "Claim All Fees" button with progress indicator
- Claim history table
- Links to Solscan for verification

**UI Layout**:
```text
┌─────────────────────────────────────────────────────────────┐
│  🏦 Treasury Fee Recovery                      [Refresh]   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │Total Pools │ │Registered  │ │Unregistered│ │Claimable │ │
│  │    529     │ │     12     │ │    517     │ │ 45.2 SOL │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│  [Scan All Pools]  [Claim All Fees]  [Export CSV]          │
├─────────────────────────────────────────────────────────────┤
│  Pool Address        │ Mint      │ Status    │ Claimable   │
│  5xYz...AbCd         │ TOK1...   │ ✓ Active  │ 0.125 SOL   │
│  7mNo...EfGh         │ TOK2...   │ ⚠ Unreg   │ 0.543 SOL   │
│  ...                 │ ...       │ ...       │ ...         │
└─────────────────────────────────────────────────────────────┘
```

### 5. Route Registration

Add the new page to `App.tsx` routes.

### 6. Vercel API Endpoint (for claiming)

Since edge functions don't have access to `TREASURY_PRIVATE_KEY`, the claim operation must go through the Vercel API backend which has the secret.

**Location**: `api/treasury/claim-batch.ts`

**Functionality**:
- Accepts array of pool addresses
- Uses treasury keypair to sign claim transactions
- Processes pools sequentially with rate limiting
- Returns results

## Technical Approach

### Token Discovery via Helius

```typescript
// In treasury-scan-pools edge function
const response = await fetch(heliusRpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'scan-pools',
    method: 'searchAssets',
    params: {
      ownerAddress: DEPLOYER_WALLET, // CHrrxJbF7N3A622z6ajftMgAjkcNpGqTo1vtFhkf4hmQ
      tokenType: 'fungible',
      page: 1,
      limit: 1000,
    },
  }),
});
```

### Pool Address Derivation

```typescript
// For each discovered mint
import { deriveDbcPoolAddress } from '@meteora-ag/dynamic-bonding-curve-sdk';

const poolAddress = deriveDbcPoolAddress(
  WSOL_MINT,        // Quote token
  mintPubkey,       // Base token (the launched token)
  configPubkey      // Pool config
);
```

**Challenge**: The `configPubkey` is not deterministic - it's generated at pool creation time. 

**Solution**: Query all pools on-chain where `feeClaimer` = deployer wallet, or iterate through known config patterns.

**Alternative Approach**: Use Helius `getProgramAccounts` to find all DBC pools where the `feeClaimer` field matches the treasury wallet.

### Fee Claiming Flow

```typescript
// In api/treasury/claim-batch.ts
for (const poolAddress of poolAddresses) {
  const { signature, claimedSol } = await claimPartnerFees(poolAddress);
  results.push({ poolAddress, claimedSol, signature });
  await delay(500); // Rate limiting
}
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/treasury-scan-pools/index.ts` | Create | Pool discovery edge function |
| `api/treasury/claim-batch.ts` | Create | Batch claiming API endpoint |
| `src/pages/TreasuryAdminPage.tsx` | Create | Admin UI page |
| `src/App.tsx` | Modify | Add route for `/admin/treasury` |

## Migration SQL

```sql
-- Table to track treasury claims from all pools
CREATE TABLE IF NOT EXISTS treasury_fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL,
  mint_address TEXT,
  token_name TEXT,
  claimed_sol NUMERIC NOT NULL DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  is_registered BOOLEAN DEFAULT false
);

-- Index for efficient queries
CREATE INDEX idx_treasury_claims_pool ON treasury_fee_claims(pool_address);
CREATE INDEX idx_treasury_claims_date ON treasury_fee_claims(claimed_at DESC);

-- RLS: Only allow service role access
ALTER TABLE treasury_fee_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny direct access to treasury claims"
  ON treasury_fee_claims FOR ALL
  USING (false);
```

## Security Considerations

1. **Password Protection**: Admin page requires secret password
2. **Treasury Key**: Only accessible via Vercel API (not edge functions)
3. **RLS Policies**: Treasury claims table is service-role only
4. **Rate Limiting**: Claims are processed sequentially with delays

## Success Criteria

1. Can discover all 529+ tokens launched by deployer
2. Can identify which pools have unclaimed fees
3. Can claim fees from all pools with one action
4. Claims are tracked for audit purposes
5. Page is password-protected and secure
