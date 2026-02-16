

## Fix: CP-AMM "ExceedMaxFeeBps" Error (Error 6004)

### Root Cause

The Meteora CP-AMM on-chain program does not allow zero trading fees. The current backend code passes `startingFeeBps: 0` and `endingFeeBps: 0`, which the SDK encodes as a zero fee numerator. The on-chain program validates this and rejects it with error 6004 ("Exceeded max fee bps").

### Fix

**File: `api/pool/create-fun-mode.ts`** (lines 194-203)

Change the fee configuration from 0 bps to 1 bps (0.01%) -- the smallest valid fee the program accepts:

```typescript
// Minimal fee config (0.01% - lowest allowed by CP-AMM)
const minBaseFee = getBaseFeeParams({
  baseFeeMode: BaseFeeMode.FeeTimeSchedulerLinear,
  feeTimeSchedulerParam: {
    startingFeeBps: 1,
    endingFeeBps: 1,
    numberOfPeriod: 0,
    totalDuration: 0,
  },
}, 9, ActivationType.Slot);
```

Also update `trading_fee_bps` in the edge function's database insert (in `supabase/functions/fun-mode-create/index.ts`) from `0` to `1` to match, and update the frontend display text from "0%" to "0.01%" in `FunModePage.tsx`.

### Technical Details

- `bpsToFeeNumerator(0)` produces a zero numerator, which the on-chain program rejects
- `bpsToFeeNumerator(1)` produces the minimum valid numerator (0.01% fee)
- 0.01% is effectively zero for prank token purposes ($0.0001 per $1 traded)

### Files Changed

1. **`api/pool/create-fun-mode.ts`** -- Change `startingFeeBps: 0` and `endingFeeBps: 0` to `1`
2. **`supabase/functions/fun-mode-create/index.ts`** -- Change `trading_fee_bps: 0` to `1`
3. **`src/pages/FunModePage.tsx`** -- Update any "0%" fee display to "0.01%" (if present)

