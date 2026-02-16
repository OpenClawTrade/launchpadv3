
# Fix Launch Result Modal: Color Scheme + Overflow

## Issues
1. The "Launch Failed" modal still uses hardcoded green colors (`hsl(160,30%,6%)`, `hsl(160,20%,10%)`) instead of the new theme variables
2. Long error messages (like base58 signatures) overflow the dialog borders -- no text wrapping or truncation

## Changes

### File: `src/pages/FunLauncherPage.tsx`

**Color fixes (line ~782-829):**
- `bg-[hsl(160,30%,6%)]` -> `bg-card` (uses theme variable)
- `border-primary/30` stays (already uses theme primary)
- `shadow-[0_0_60px_rgba(16,185,129,0.15)]` -> `shadow-[0_0_60px_hsl(var(--primary)/0.15)]`
- `bg-[hsl(160,20%,10%)]` (token info card, contract card) -> `bg-background`

**Overflow fix (line ~802):**
- Wrap the error description in a container with `break-all overflow-hidden max-w-full` so long signatures wrap within the dialog instead of overflowing
- Add `word-break: break-all` to the error text element
- Optionally truncate signatures to show first/last characters with "..." in between

### Summary
| Line | Current | New |
|------|---------|-----|
| 782 | `bg-[hsl(160,30%,6%)]` | `bg-card` |
| 782 | `shadow-[...rgba(16,185,129,...)]` | `shadow-[0_0_60px_hsl(var(--primary)/0.15)]` |
| 802 | Plain text error | `break-all` + text truncation for long signatures |
| 810 | `bg-[hsl(160,20%,10%)]` | `bg-background` |
| 829 | `bg-[hsl(160,20%,10%)]` | `bg-background` |
