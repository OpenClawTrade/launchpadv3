

## Plan: Image Download Buttons + Full Portfolio Page

### Issue 1: Download Button Missing on Non-Random Modes

**Current state**: Only the "Random" mode in `TokenLauncher.tsx` has a download button overlay on the generated image (lines 1637-1651). The "Describe", "Realistic", "Custom", "Phantom", "Holders", and "Fun" modes all render plain `<img>` tags without download functionality.

**Fix**: Add the same download button overlay (hover-visible Download icon) to all image preview avatars across all modes in `TokenLauncher.tsx`. There are ~10 instances of `gate-token-preview-avatar` that need the download button wrapper.

### Issue 2: X (Close) Button Not Visible in Image Overview

**Current state**: There is no image lightbox/overlay component at all. When the user refers to "image overview" and the X button not being visible, this likely means the generated image preview area has no clear way to dismiss/remove the generated image to start fresh.

**Fix**: Add a visible X (close) button on the image preview to clear the generated image (set meme/describedToken/etc. to null). Position it at top-right of the image with solid background so it's always visible, not just on hover.

### Issue 3: Portfolio — Full Page Instead of Modal

**Current state**: 
- Header wallet dropdown opens `PortfolioModal` (a small overlay with basic holdings + sell buttons)
- `/portfolio` redirects to `/panel?tab=portfolio` 
- `PanelPortfolioTab.tsx` shows holdings + created tokens but NO sell functionality, NO PnL, NO search, NO Axiom-style layout

**Reference (Axiom screenshot)**: Shows a full dashboard with:
- Balance summary (Total Value, Unrealized PnL, Tradeable Balance)
- Realized PnL chart
- Performance stats (Total PnL, Realized PnL, Total TXNs, win rate distribution)
- Active Positions table with columns: Token, Bought, Sold, Remaining, PnL, Action buttons
- Tabs: Active Positions, History, Top 100
- Search, filters, USD toggle

**Fix**: 
1. Create a dedicated `/portfolio` page (remove the redirect to panel)
2. Build `PortfolioPage.tsx` with Axiom-inspired layout:
   - **Top row**: Balance card (Total Value, Unrealized PnL) + Realized PnL chart (Recharts) + Performance stats
   - **Bottom section**: Tabbed table (Active Positions / History) with Token, Bought, Sold, Remaining, PnL columns
   - Sell action buttons per row (reuse `useTurboSwap`)
   - Search bar for filtering tokens
3. Update header dropdown "Portfolio" to navigate to `/portfolio` instead of opening modal
4. Keep the modal as a quick-access option but primary access goes to full page

### Files to Modify

| File | Change |
|---|---|
| `src/components/launchpad/TokenLauncher.tsx` | Add download + close buttons to all mode image previews |
| `src/pages/PortfolioPage.tsx` | **New** — Full Axiom-style portfolio page |
| `src/App.tsx` | Change `/portfolio` from redirect to render `PortfolioPage` |
| `src/components/layout/HeaderWalletBalance.tsx` | Change Portfolio menu item to navigate to `/portfolio` |
| `src/components/portfolio/PortfolioModal.tsx` | Keep as-is (quick access fallback) |

