# TRENCHES Launchpad - Meteora Fee System Documentation

## Overview

This document provides complete technical specifications for the fee system across both bonding (DBC) and graduated (DAMM V2) phases.

---

## Fee Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FEE CLAIMING FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BONDING PHASE (DBC Pool)                                   │
│  ├─ SDK: @meteora-ag/dynamic-bonding-curve-sdk              │
│  ├─ Method: claimPartnerTradingFee()                        │
│  ├─ Claimer: feeClaimer wallet (treasury)                   │
│  └─ Fees: 2% of all trades → treasury                       │
│                                                             │
│  ───────────── GRADUATION (85 SOL threshold) ─────────────  │
│                                                             │
│  GRADUATED PHASE (DAMM V2 Pool)                             │
│  ├─ SDK: @meteora-ag/cp-amm-sdk                             │
│  ├─ Method: claimPositionFee()                              │
│  ├─ Claimer: Position NFT owner (treasury)                  │
│  └─ Fees: 2% of all trades → Position NFT → treasury        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Values

### Pool Creation Config (api/lib/meteora.ts)

```typescript
{
  feeClaimer: PLATFORM_FEE_WALLET,           // Treasury wallet - receives all DBC fees
  partnerLockedLpPercentage: 100,            // 100% LP locked to treasury on graduation
  creatorTradingFeePercentage: 0,            // 0% to creator = 100% to treasury
  
  // Fee config - 2% total
  baseFee: {
    cliffFeeNumerator: new BN(20000000),     // 200 bps = 2%
  },
  
  // Migration config  
  migrationOption: 1,                         // DAMM V2
  migrationFeeOption: 6,                      // Customizable (required for custom fees)
  migratedPoolFee: {
    collectFeeMode: 0,                        // Collect in quote token (SOL)
    dynamicFee: 0,                            // Disabled
    poolFeeBps: 200,                          // 2% continues post-migration
  },
  
  // LP Distribution
  partnerLpPercentage: 0,                     // No unlocked LP
  creatorLpPercentage: 0,                     // No creator LP
  partnerLockedLpPercentage: 100,             // All LP locked to treasury
  creatorLockedLpPercentage: 0,               // No creator locked LP
}
```

### Environment Config (api/lib/config.ts)

```typescript
PLATFORM_FEE_WALLET = "CHrrxJbF7N3A622z6ajftMgAjkcNpGqTo1vtFhkf4hmQ"  // Treasury wallet
TRADING_FEE_BPS = 200                                                // 2%
GRADUATION_THRESHOLD_SOL = 85                                        // SOL to graduate
MIGRATED_POOL_FEE_BPS = 200                                         // 2% post-graduation
```

---

## API Endpoints

### 1. Pre-Graduation: Claim DBC Pool Fees

**Endpoint:** `POST /api/fees/claim-from-pool`

**Request:**
```json
{
  "poolAddress": "DBC_POOL_ADDRESS",
  "tokenId": "TOKEN_UUID (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "signature": "TX_SIGNATURE",
  "claimedSol": 0.5,
  "poolAddress": "...",
  "tokenId": "..."
}
```

**Implementation:** Uses `@meteora-ag/dynamic-bonding-curve-sdk`
```typescript
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

const client = new DynamicBondingCurveClient(connection, 'confirmed');
const claimTx = await client.partner.claimPartnerTradingFee({
  payer: treasury.publicKey,
  feeClaimer: treasury.publicKey,
  pool: poolPubkey,
  maxBaseAmount: new BN('18446744073709551615'),
  maxQuoteAmount: new BN('18446744073709551615'),
});
```

---

### 2. Post-Graduation: Claim DAMM V2 Position Fees

**Endpoint:** `POST /api/fees/claim-damm-fees`

**Request:**
```json
{
  "tokenId": "TOKEN_UUID",
  "dammPoolAddress": "DAMM_POOL_ADDRESS (optional)",
  "positionAddress": "POSITION_NFT_ADDRESS (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "signature": "TX_SIGNATURE",
  "poolAddress": "...",
  "positionAddress": "...",
  "tokenId": "..."
}
```

**Implementation:** Uses `@meteora-ag/cp-amm-sdk`
```typescript
import { CpAmm } from '@meteora-ag/cp-amm-sdk';

const cpAmm = new CpAmm(connection);

// 1. Get treasury's position NFTs
const positions = await cpAmm.getPositionsByUser(treasury.publicKey);

// 2. Find the position for this pool
const targetPosition = positions.find(p => 
  p.positionState.pool.toBase58() === poolAddress
);

// 3. Claim fees from position
const claimTx = await cpAmm.claimPositionFee({
  owner: treasury.publicKey,
  position: targetPosition.position,
  pool: poolPubkey,
  positionNftAccount: targetPosition.positionNftAccount,
  tokenAMint: poolState.tokenAMint,
  tokenBMint: poolState.tokenBMint,
  tokenAVault,
  tokenBVault,
  tokenAProgram: TOKEN_PROGRAM_ID,
  tokenBProgram: TOKEN_PROGRAM_ID,
  receiver: treasury.publicKey,
});
```

---

### 3. Pool Migration (with Pre-Claim Safeguard)

**Endpoint:** `POST /api/pool/migrate`

**Request:**
```json
{
  "mintAddress": "TOKEN_MINT_ADDRESS"
}
```

**Response:**
```json
{
  "success": true,
  "signatures": ["sig1", "sig2", "sig3"],
  "dammPoolAddress": "...",
  "preClaimSignature": "sig0 (if fees claimed)",
  "preClaimSol": 0.5,
  "message": "Pool successfully migrated to DAMM V2. Claimed 0.5 SOL in pre-migration fees."
}
```

**CRITICAL:** The migration endpoint now automatically claims DBC fees BEFORE migrating. This is essential because:
- After migration, the DBC pool is closed
- Any unclaimed DBC fees would be LOST forever
- The pre-claim happens in the same transaction flow to ensure no fees are missed

---

## Critical Implementation Notes

### 1. Position NFT Ownership

When using `partnerLockedLpPercentage: 100`:
- The treasury wallet receives a **Position NFT** representing the locked LP
- This NFT is the key to claiming accumulated trading fees from DAMM V2 pools
- The Position NFT must be held by the same wallet that will claim fees

### 2. Fee Accumulation Post-Migration

With `migrationFeeOption: 6` and `poolFeeBps: 200`:
- Fees accumulate **on the Position NFTs**, not in the pool itself
- The treasury's Position NFT (from 100% locked LP) accrues its share of the 2% trading fees
- You must claim **from the Position NFT**, not from the pool directly

### 3. Pre-Migration Fee Safety

**CRITICAL:** Unclaimed DBC fees are NOT automatically transferred during migration!
- You MUST claim DBC fees before or during migration
- After migration completes, the DBC pool is closed
- Any unclaimed DBC fees WILL BE LOST

The migration endpoint now handles this automatically.

### 4. creatorTradingFeePercentage: 0 Behavior

- **Pre-graduation (DBC):** 100% of 2% fees → feeClaimer (treasury)
- **Post-graduation (DAMM V2):** Fees go to Position NFT holders based on LP share

Since treasury holds 100% of locked LP via `partnerLockedLpPercentage: 100`, treasury gets 100% of DAMM V2 fees too.

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/config.ts` | Fee configuration constants |
| `lib/meteora.ts` | Meteora SDK integration, pool creation, swaps |
| `api/fees/claim-from-pool.ts` | DBC pool fee claiming (pre-graduation) |
| `api/fees/claim-damm-fees.ts` | DAMM V2 position fee claiming (post-graduation) |
| `api/pool/migrate.ts` | Pool graduation/migration with pre-claim safeguard |
| `src/hooks/useMeteoraApi.ts` | Frontend API integration |

---

## Testing Checklist

- [ ] Create a token and verify DBC pool receives fees
- [ ] Claim DBC fees using `/api/fees/claim-from-pool`
- [ ] Graduate token (reach 85 SOL threshold)
- [ ] Verify migration claims DBC fees first
- [ ] Verify treasury receives Position NFT
- [ ] Claim DAMM V2 fees using `/api/fees/claim-damm-fees`
- [ ] Verify fees go to treasury wallet

---

## Troubleshooting

### "No LP positions found for treasury wallet"
- The token hasn't graduated yet (still in bonding phase)
- Use `/api/fees/claim-from-pool` instead for bonding phase tokens

### "Position not found"
- The pool address doesn't match any Position NFTs
- Check if token has correct `damm_pool_address` in database

### "Insufficient fees to claim"
- Minimum 0.001 SOL required to claim
- Wait for more trading activity

### "Pool already migrated"
- Token has already graduated
- Use DAMM V2 claim endpoint instead
