

## Plan: Azura-Style Half-Width Sparkline + Better Rendering

### Problem
1. Tokens without trade data show a full-width flat green line — looks broken
2. Even active coins may appear flat because the sparkline data lacks granularity or the canvas rendering doesn't show enough variation

### Changes

**1. `src/components/launchpad/SparklineCanvas.tsx`**
- Add an `isFallback` detection: when all data points are identical (e.g. `[1, 1]`), draw a **half-width** green line centered vertically on the **right half** of the canvas (mimicking Azura's style where the chart sits on the right side)
- For real data: position the sparkline on the **right ~60%** of the card (like Azura) rather than spanning the full width, so the chart is more visible and condensed with better visual movement
- Increase line opacity from `0.3` to `0.5` for better visibility
- Increase gradient opacity for more pronounced fill under the curve

**2. Visual improvements to match Azura reference:**
- Sparkline drawn from ~40% of card width to the right edge (not full width)
- This compresses real price data into a tighter space, making movements more pronounced
- For fallback (no data): draw a subtle straight green line across the right half at vertical center with a soft glow

### Files Modified
- `src/components/launchpad/SparklineCanvas.tsx` (only file)

