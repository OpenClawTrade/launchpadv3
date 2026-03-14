

## Plan: Multiple UI Fixes & Enhancements

### 1. Set Solana as Default Chain
**File:** `src/contexts/ChainContext.tsx` (line 85)
- Change default from `'bnb'` to `'solana'`

### 2. Fix Balance Showing "0" in Trade Panel
**Files:** `src/components/launchpad/UniversalTradePanel.tsx`, `src/components/launchpad/MobileTradePanelV2.tsx`
- The balance fetch depends on `isAuthenticated && solanaAddress` — if the user's wallet hasn't resolved yet when the component mounts, balance stays null/0. Will add a re-fetch trigger when `effectiveWallet` changes and ensure `getBalance()` is called with the embedded wallet context. Will also ensure initial state starts as `null` (showing "—") rather than `0`.

### 3. Allow Manual Slippage Edit in Trade Panels
**Files:** `src/components/launchpad/UniversalTradePanel.tsx`, `src/components/launchpad/MobileTradePanelV2.tsx`, `src/components/launchpad/AdvancedSettingsSheet.tsx`
- The custom slippage input exists but is hidden behind a ⚙️ toggle button. Will replace the toggle with an always-visible inline custom input field next to presets, so users can type any value directly without clicking ⚙️ first.

### 4. Replace "Users Registered" in Footer with Crypto Prices (Desktop)
**File:** `src/components/layout/StickyStatsFooter.tsx`
- Remove the `Users` count from the center section (lines 349-353)
- On desktop, show ETH, BTC, and BNB prices (price only, no 24h change %) using official coin icons (ETH diamond, BTC logo, BNB logo — from CoinGecko or inline SVGs)
- Fetch prices via existing edge functions or a simple CoinGecko proxy
- Keep mobile footer unchanged (center section already hidden on mobile)

### 5. Replace Hero Right-Side Image with Uploaded Screenshot
**File:** Copy `user-uploads://launchsaturn.png` → `src/assets/hero-launch-mockup.png`
- The right-side hero image at line 384 of `HomePage.tsx` already uses `heroLaunchMockup` imported from `@/assets/hero-launch-mockup.png`
- Simply replacing that asset file with the uploaded image will update it everywhere automatically

### Technical Notes
- For footer crypto prices, will create a lightweight `FooterCryptoPrices` component that fetches BTC/ETH/BNB prices from CoinGecko via the existing `sol-price` edge function pattern (or a new multi-price endpoint)
- Official SVG icons for BTC (₿ orange), ETH (⟠ blue), BNB (yellow) will be inlined

