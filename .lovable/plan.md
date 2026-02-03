
# PUMP Agents Complete Implementation Plan

## Overview

This plan implements a fully working pump.fun integration with:
1. **Fixed token launching** - Proper Ed25519 keypair generation and correct PumpPortal API usage
2. **Fee claiming system** - Automated collection of creator fees every 5 minutes
3. **Fee distribution** - 80/20 split (creator/platform) matching the existing TUNA agents model

---

## Current State Analysis

| Component | Status | Issue |
|-----------|--------|-------|
| Meme Generation | ✅ Working | `agent-idea-generate` returns valid images |
| Keypair Generation | ❌ Broken | Uses random bytes instead of Ed25519 |
| PumpPortal Payload | ❌ Wrong | Passes private key as `publicKey` field |
| Mint Address Extraction | ❌ Missing | Uses broken keypair instead of API response |
| Fee Claiming | ❌ Not Implemented | No edge function exists |
| Fee Distribution | ❌ Not Implemented | No cron job for pump.fun tokens |
| Database | ⚠️ Partial | `fun_tokens` has `launchpad_type` column |

**Secrets Available:**
- `PUMPPORTAL_API_KEY` ✅
- `PUMP_DEPLOYER_PRIVATE_KEY` ✅
- `TREASURY_PRIVATE_KEY` ✅
- `HELIUS_RPC_URL` ✅

---

## Implementation Steps

### Step 1: Fix `pump-agent-launch` Edge Function

**File:** `supabase/functions/pump-agent-launch/index.ts`

**Changes Required:**

1. **Import proper Solana libraries:**
```typescript
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";
```

2. **Fix keypair generation** - Replace the broken `generateMintKeypair()` with:
```typescript
function generateMintKeypair(): { keypair: Keypair; secretKeyBase58: string } {
  const keypair = Keypair.generate();
  const secretKeyBase58 = bs58.encode(keypair.secretKey);
  return { keypair, secretKeyBase58 };
}
```

3. **Fix PumpPortal payload** - Parse deployer's PUBLIC key from the private key:
```typescript
// Parse deployer keypair
let deployerKeypair: Keypair;
if (deployerPrivateKey.startsWith("[")) {
  const keyArray = JSON.parse(deployerPrivateKey);
  deployerKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
} else {
  deployerKeypair = Keypair.fromSecretKey(bs58.decode(deployerPrivateKey));
}

const createPayload = {
  publicKey: deployerKeypair.publicKey.toBase58(), // PUBLIC key, not private!
  action: "create",
  tokenMetadata: { name, symbol, uri: metadataUri },
  mint: mintKeypair.secretKeyBase58,
  denominatedInSol: "true",
  amount: initialBuySol,
  slippage: 10,
  priorityFee: 0.0005,
  pool: "pump",
};
```

4. **Extract mint address from keypair correctly:**
```typescript
const mintAddress = mintKeypair.keypair.publicKey.toBase58();
```

5. **Store deployer public key in database:**
```typescript
creator_wallet: deployerKeypair.publicKey.toBase58(),
deployer_wallet: deployerKeypair.publicKey.toBase58(),
```

---

### Step 2: Create `pump-claim-fees` Edge Function

**File:** `supabase/functions/pump-claim-fees/index.ts`

This function:
1. Queries `fun_tokens` where `launchpad_type = 'pumpfun'` and `status = 'active'`
2. Calls PumpPortal's `collectCreatorFee` endpoint for each token
3. Records claims in `pumpfun_fee_claims` table
4. Updates token's `total_fees_earned` field

**PumpPortal API Call:**
```typescript
const response = await fetch("https://pumpportal.fun/api/trade?api-key=" + apiKey, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "collectCreatorFee",
    mint: token.mint_address,
    priorityFee: 0.0001,
    pool: "pump"
  })
});
```

---

### Step 3: Create Database Table for Fee Tracking

**Table:** `pumpfun_fee_claims`

```sql
CREATE TABLE pumpfun_fee_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id UUID REFERENCES fun_tokens(id),
  mint_address TEXT NOT NULL,
  claimed_sol NUMERIC DEFAULT 0,
  signature TEXT,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  distributed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pumpfun_claims_token ON pumpfun_fee_claims(fun_token_id);
CREATE INDEX idx_pumpfun_claims_undistributed ON pumpfun_fee_claims(distributed) WHERE distributed = false;
```

---

### Step 4: Update Fee Distribution Logic

**File:** `supabase/functions/fun-distribute/index.ts`

Add handling for pump.fun tokens in the distribution logic:

```typescript
// In the undistributed claims query, also fetch pumpfun_fee_claims
const { data: pumpfunClaims } = await supabase
  .from("pumpfun_fee_claims")
  .select(`*, fun_token:fun_tokens(*)`)
  .eq("distributed", false);

// Apply 80/20 split (same as agent tokens)
const creatorShare = claimedSol * 0.8;  // 80% to creator
const platformShare = claimedSol * 0.2; // 20% to platform
```

---

### Step 5: Create Cron Job for Fee Claiming

**SQL to add cron job:**
```sql
SELECT cron.schedule(
  'pump-claim-fees-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ptwytypavumcrbofspno.supabase.co/functions/v1/pump-claim-fees',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

---

### Step 6: Update config.toml

Add the new edge function:
```toml
[functions.pump-claim-fees]
verify_jwt = false
```

---

## Technical Details

### PumpPortal API Reference

**Token Creation (Lightning API):**
```
POST https://pumpportal.fun/api/trade?api-key=YOUR_KEY
{
  "publicKey": "DEPLOYER_PUBLIC_KEY",
  "action": "create",
  "tokenMetadata": { "name": "...", "symbol": "...", "uri": "..." },
  "mint": "MINT_KEYPAIR_SECRET_BASE58",
  "denominatedInSol": "true",
  "amount": 0.01,
  "slippage": 10,
  "priorityFee": 0.0005,
  "pool": "pump"
}
```

**Fee Collection (Lightning API):**
```
POST https://pumpportal.fun/api/trade?api-key=YOUR_KEY
{
  "action": "collectCreatorFee",
  "mint": "TOKEN_MINT_ADDRESS",
  "priorityFee": 0.0001,
  "pool": "pump"
}
```

### Database Schema for pump.fun Tokens

The existing `fun_tokens` table already has these columns:
- `launchpad_type` - Set to `'pumpfun'` for pump.fun tokens
- `pumpfun_signature` - Transaction signature from creation
- `pumpfun_bonding_curve` - Optional bonding curve address
- `pumpfun_creator` - Creator address on pump.fun
- `deployer_wallet` - The wallet that deployed the token
- `total_fees_earned` - Running total of claimed fees

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/pump-agent-launch/index.ts` | Modify | Fix keypair and payload |
| `supabase/functions/pump-claim-fees/index.ts` | Create | New fee claiming function |
| `supabase/config.toml` | Modify | Add pump-claim-fees config |
| Database migration | Create | Add pumpfun_fee_claims table |

---

## Testing Plan

After implementation:
1. Generate a meme on `/agents/pump`
2. Click "Launch on pump.fun"
3. Verify token appears on pump.fun
4. Check edge function logs for success
5. Wait 5 minutes for fee claim cron
6. Verify fees appear in database

---

## Fee Flow Diagram

```text
+------------------+     +------------------+     +------------------+
|   pump.fun       | --> | pump-claim-fees  | --> | pumpfun_fee_     |
|   Trading Fees   |     |   (every 5 min)  |     |   claims table   |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                         +------------------+     +------------------+
                         |  fun-distribute  | <-- | Query undistrib- |
                         |  (every 1 min)   |     |   uted claims    |
                         +------------------+     +------------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
           +----------------+           +----------------+
           | 80% to Creator |           | 20% to Platform|
           | (SOL transfer) |           |   (treasury)   |
           +----------------+           +----------------+
```

---

## Summary

This implementation:
- ✅ Fixes the broken keypair generation using proper Solana libraries
- ✅ Corrects the PumpPortal API payload (public key, not private)
- ✅ Creates automated fee claiming every 5 minutes
- ✅ Distributes fees with 80/20 creator/platform split
- ✅ Tracks all claims in database for transparency
- ✅ Integrates with existing TUNA infrastructure

