

## Plan: Fix Token Image Preview Size & Footer Crypto Prices

### Issue 1: Image Preview Too Small (No Download/X Visible)
The `.gate-token-preview-avatar` CSS is 48x48px — too small for the `ImagePreviewOverlay` buttons (X to clear, Download) to be visible or usable.

**Fix:** In `src/styles/gate-theme.css`, increase `.gate-token-preview-avatar` from `48px` to `120px` (or similar) so the generated image is large enough to show the overlay buttons clearly. Also add `position: relative` to ensure the absolutely-positioned buttons render correctly within the container.

### Issue 2: Footer Crypto Prices Show "—" for ~60s
The `FooterCryptoPrices` component in `StickyStatsFooter.tsx` has no localStorage cache — it shows "—" until the first edge function call returns. With many concurrent users, every visitor makes their own call.

**Fix in `FooterCryptoPrices`:**
- Add localStorage cache (like the existing `BnbPriceDisplay` pattern) — initialize state from cache so prices show instantly on load.
- On fetch success, write to localStorage with timestamp.
- On mount, if cache is fresh (< 60s), skip the first fetch entirely.
- Keep the 60s interval for background refresh.

This means 1000 users won't each make an independent call — they'll use cached data from their previous session and only refresh every 60s.

### Files to Change
1. **`src/styles/gate-theme.css`** — increase `.gate-token-preview-avatar` dimensions to ~120px
2. **`src/components/layout/StickyStatsFooter.tsx`** — add localStorage caching to `FooterCryptoPrices`

