# Axiom Migration Display Fix - Progress History

## Problem
Tokens launched on buildtuna.com do not show "Migration Market Cap" or graduation progress on Axiom/DEXTools/Birdeye terminals.

## Reference Working Pool
- **Pool Address**: `AhTyeJiNbFK72KCZn6GTDCs6iEDLwYBdTagSrfHi8BLx`
- **Axiom URL**: https://axiom.trade/meme/AhTyeJiNbFK72KCZn6GTDCs6iEDLwYBdTagSrfHi8BLx?chain=sol
- This pool correctly shows migration/graduation UI

---

## Attempted Fixes (Chronological)

### Attempt 1: Added `?chain=sol` to Axiom URLs
- **Date**: 2025-01-21
- **Files Modified**: Various components
- **Result**: ❌ FAILED - This only affects URL routing, not on-chain data encoding
- **Why It Failed**: The issue is in how the pool configuration is encoded on-chain, not the URL

### Attempt 2: Set `leftoverReceiver` to user's wallet instead of treasury
- **Date**: 2025-01-21
- **Files Modified**: `lib/meteora.ts`, `api/pool/create-fun.ts`
- **Result**: ❌ FAILED - Did not fix the migration display
- **Why It Failed**: `leftoverReceiver` affects LP distribution, not curve encoding

### Attempt 3: Ensured correct SDK enums (ActivationType.Timestamp, MigrationOption.MET_DAMM_V2)
- **Date**: Earlier attempts
- **Files Modified**: `lib/meteora.ts`
- **Result**: ❌ FAILED - Correct enums but curve still manually calculated
- **Why It Failed**: Terminals decode the bonding curve points to infer migration thresholds

### Attempt 4: Used MigrationFeeOption.FixedBps200 instead of Customizable
- **Date**: Earlier attempts
- **Files Modified**: `lib/meteora.ts`
- **Result**: ❌ FAILED - Still no migration display
- **Why It Failed**: Fee option doesn't affect curve calculation

### Attempt 5: Created config-inspect endpoint to compare configurations
- **Date**: 2025-01-21
- **Files Modified**: `api/pool/config-inspect.ts`, `supabase/config.toml`
- **Result**: ⏳ DIAGNOSTIC TOOL - Used to identify differences
- **Finding**: Need to compare on-chain curve encoding with working pool

---

## Current Attempt (Attempt 6): Use SDK's buildCurveWithMarketCap

### Hypothesis
The Meteora SDK provides `buildCurveWithMarketCap(...)` which calculates:
1. `sqrtStartPrice` - Starting price based on market cap
2. `curve` - Array of bonding curve points with proper encoding
3. `migrationQuoteThreshold` - Exact SOL threshold for graduation

The **manual calculations** in `lib/meteora.ts`:
- `calculateBondingCurve()` - Returns hardcoded curve points
- `getSqrtStartPrice()` - Returns hardcoded starting price

These manual values may not match what Axiom's decoder expects for the migration fields.

### Implementation Plan
1. ✅ Import `buildCurveWithMarketCap` from SDK
2. ✅ Create `buildCurveConfig()` function that wraps SDK call
3. ✅ Replace manual `calculateBondingCurve()` and `getSqrtStartPrice()` with SDK-generated values
4. ✅ Spread the curveConfig result into `createConfigAndPoolWithFirstBuy` params

### Code Changes Made (2025-01-21)
**File: lib/meteora.ts**
- Added import: `buildCurveWithMarketCap` from SDK
- Added import: `INITIAL_VIRTUAL_SOL` from config
- Created new `buildCurveConfig()` function that calls SDK
- Modified `createMeteoraPoolWithMint()` to use `...curveConfig` spread
- Deprecated manual `calculateBondingCurve()` and `getSqrtStartPrice()` (kept for reference)

### Parameters for buildCurveWithMarketCap
```typescript
buildCurveWithMarketCap({
  initialMarketCap: 30,        // 30 SOL starting market cap
  migrationMarketCap: 85,      // 85 SOL graduation threshold
  totalTokenSupply: 1_000_000_000,
  tokenBaseDecimal: 6,
  tokenQuoteDecimal: 9,        // SOL has 9 decimals
  // ... other params from SDK requirements
})
```

### Files to Modify
- `lib/meteora.ts` - Replace manual curve with SDK calculation

---

## Technical Details

### Current Manual Curve Values (lib/meteora.ts:60-85)
```typescript
// These are MANUALLY calculated and may not match Axiom's decoder
sqrtStartPrice: new BN('95072344172433750')
curve: [
  { sqrtPrice: new BN('380289371323205464'), liquidity: new BN('101410499496546307411360885487802') },
  { sqrtPrice: new BN('79226673521066979257578248091'), liquidity: new BN('3434578513360188981331421') },
]
```

### SDK buildCurveWithMarketCap
The SDK calculates these values internally using:
- Proper mathematical formulas for price/liquidity relationship
- Migration threshold encoding that matches terminal expectations
- Curve points that enable proper graduation progress calculation

---

## Verification Steps After Fix
1. Launch a new token using updated code
2. Use `/api/pool/config-inspect` to compare with working pool
3. Check Axiom for migration display
4. Verify graduation progress percentage updates with trades

---

## Diagnostic Tooling Updates

### Update: Switched `config-inspect` to SDK decoding (2026-01-21)
- **File**: `api/pool/config-inspect.ts`
- **Problem**: Our earlier byte-offset decoder was **not reliable** (fields like `quoteMint`/`tokenDecimal` were being mis-read), leading to false conclusions.
- **Solution**: Use the Meteora SDK state getters (`DynamicBondingCurveClient.state.getPool` + `getPoolConfig`) and only compare SDK-decoded fields.
- **Why this matters**: Now when Axiom doesn’t show migration, we can prove exactly which on-chain field differs versus a known-good pool.

---

## Bug Fix Log

### Fix 1: Removed invalid `periodFrequency` property (2025-01-21)
- **File**: `lib/meteora.ts`
- **Issue**: TypeScript error TS2353 - `periodFrequency` does not exist in type `FeeSchedulerParams`
- **Solution**: Removed `periodFrequency: 0` from `feeSchedulerParam` object
- **Root Cause**: SDK's `FeeSchedulerParams` interface only accepts specific properties

### Fix 2: Added required `totalDuration` property (2025-01-21)
- **File**: `lib/meteora.ts`
- **Issue**: TypeScript error TS2741 - `totalDuration` missing in `FeeSchedulerParams`
- **Solution**: Added `totalDuration: 0` to `feeSchedulerParam` object
- **Root Cause**: SDK requires `totalDuration` even when `numberOfPeriod` is 0

---

## Key Learnings
1. **Always use SDK helpers** - Manual curve calculations don't match terminal decoder expectations
2. **Check SDK types before adding properties** - `FeeSchedulerParams` ≠ `FeeScheduler` class constructor
3. **Document each attempt** - Prevents repeating failed strategies
4. **Reference working pools** - Side-by-side comparison is crucial for debugging terminal display issues
