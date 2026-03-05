
Goal: make candles ~5x thinner and force chart data to open/right-anchor like your reference (not centered).

Implementation plan (single file): `src/components/launchpad/CodexChart.tsx`

1) Make candle width truly thin (5x smaller)
- Introduce explicit constants for spacing instead of hardcoded values:
  - `NORMAL_BAR_SPACING = 0.8` (current is 4 → 5x thinner)
  - `NORMAL_MIN_BAR_SPACING = 0.2`
  - `SPARSE_BAR_SPACING = 1.6` (current is 8 → 5x thinner)
  - `SPARSE_MIN_BAR_SPACING = 0.4`
- Apply these in:
  - chart creation `timeScale` defaults
  - sparse/non-sparse `applyOptions` in data update effect
- Keep wick visibility but with thinner body look (spacing change is the main control for “fat” candles).

2) Fix right-side anchoring (remove centered behavior)
- Replace current sparse range logic (`from: -5, to: bars.length + 5`) because it centers small datasets.
- Use a right-anchored logical range formula for both sparse and dense datasets:
  - `rightPaddingBars = 2`
  - Sparse visible window fixed (ex: 14 bars) so 2–6 candles appear near right edge, not middle
  - Dense visible window (ex: last 160 bars) with same right padding
- Set:
  - `from = bars.length - visibleBars`
  - `to = bars.length + rightPaddingBars`
- Clamp `from` safely for tiny datasets.

3) Ensure right-anchor is applied at first render and after interval updates
- Keep the existing “no recreate” architecture.
- On initial load/resolution change: apply the right-anchored range once.
- On subsequent refreshes: call `timeScale().scrollToRealTime()` after `setData()` to prevent drifting/centering when new bars arrive.
- Preserve current behavior of not constantly resetting zoom when user manually pans (unless resolution/token changes).

4) Keep refresh smooth and consistent
- Keep `setData()` path unchanged (no chart remount).
- Keep volume series update logic unchanged.
- Keep price line logic unchanged.
- Only modify spacing + visible range logic to directly address your two issues.

Validation checklist after implementation
- Candles look clearly thinner (about 5x compared to current).
- On open, latest candles appear on the right side (with small right breathing room), not centered.
- 5s auto-refresh does not re-center the chart or make candles fat again.
- Sparse tokens (few bars) still open right-aligned and readable.
