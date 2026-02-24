
# Complete /trade Page Fix and 1:1 Axiom Pulse Redesign

## Problem 1: Page Won't Render (CRITICAL)
The /trade page is stuck on a loading spinner forever. The `TradePage` is lazy-loaded, and the `Suspense` fallback (a simple spinner with no sidebar/header) is shown indefinitely. This means no sidebar, no header, no content is visible at all.

**Root cause investigation needed:** The hooks (`useFunTokensPaginated`, `useCodexNewPairs`, etc.) may be hanging or the lazy chunk may fail to load. The fix will ensure the layout (sidebar + header) renders immediately regardless of data loading state.

**Fix:** Move the `LaunchpadLayout` wrapper outside the data-dependent area, or ensure the page renders the layout shell even while data loads. The `AxiomTerminalGrid` already handles its own loading state with skeletons, so the page should render immediately.

---

## Problem 2: Full Template Match (Sidebar, Header, Footer, Content)

Based on the screenshot, here is every element that must be present and matched:

### A. Left Sidebar (already exists -- keep untouched)
- CLAW logo + "CLAW MODE" text
- Nav items: Home, Terminal, Agents, NFA (with green dot), SDK, Tokenomics, Whitepaper, Panel
- Matrix toggle at bottom
- "+ Create Token" green button
- "clawsai.fun" footer text

**Status:** This already matches. No changes needed.

### B. Top Header Bar (already exists -- keep untouched)
- "Solana" chain switcher with green dot
- Search input "Search for token..."
- SOL price display
- X (Twitter) icon link
- "Panel" button with claw logo
- "+ Create Token" green button

**Status:** This already matches. No changes needed.

### C. Pulse Title Bar (needs refinement)
Current code has this but needs exact match:
- "Pulse" title bold white, left-aligned
- List icon + Settings gear icon next to title
- Right side: "Display" dropdown button, Bookmark icon, Monitor icon, Volume/Sound icon, Settings gear icon, Layout grid icon
- Counter badge: "1 = {totalCount}" with chevron

**Status:** Code exists and matches. Minor style tweaks only.

### D. Three-Column Grid Headers (needs refinement)
Each column header shows:
- Column icon (Rocket/Flame/CheckCircle) + label ("New Pairs" / "Final Stretch" / "Migrated")
- Lightning bolt icon with count number in yellow/warning color
- P1, P2, P3 small tab buttons
- Star/bookmark icon
- Filter/sliders icon

**Status:** Code exists and matches. No changes needed.

### E. Token Cards (THE MAIN FOCUS -- needs pixel-perfect match)

Each card from the screenshot has:

**Row 1 (Top section):**
- LEFT: 48x48px rounded avatar with green verified dot (bottom-right corner)
- CENTER block:
  - Line 1: Bold ticker (e.g., "Vortex") + italic full name + external link icon + optional agent sparkle badge
  - Line 2: Age (e.g., "6d") + vertical separator + social icon row: X/Twitter, Users/people, Globe/website, MessageCircle/chat, Search + holder count number
  - Line 3: "by @handle" or "by {wallet}" in muted gray + Users icon + holder count
- RIGHT block (right-aligned, stacked):
  - MC label + large bold value (e.g., "$25.5K")
  - V label + medium value
  - F label + medium value
  - TX label + count + green/red arrow + percentage change

**Row 2 (Bottom bar, separated by thin border):**
- LEFT: Graduation % with arrow icon + colored % badge dots (fee %, etc.) + "DS" badge + "Paid" green badge (conditional)
- CENTER-LEFT: Shortened address with copy icon (e.g., "H83K...pump")
- RIGHT: Blue pill button with lightning icon "0 SOL" or "2 SOL"

**Status:** Code exists and closely matches. Needs these fixes:
1. Creator line should show launchpad type name (e.g., "Pump.fun") instead of truncated wallet when no twitter handle
2. MC font size should be slightly larger (14px instead of 13px) for more visual prominence

### F. Bottom Stats Footer (already exists -- keep untouched)
- "TOKENS 702 | AGENTS 709 | FEES 19.73 SOL | POSTS 15,132 | PAYOUTS 3.30 SOL"
- "Connected" green indicator on far right

**Status:** Already matches via `StickyStatsFooter`. No changes needed.

### G. Big Footer (should NOT show on /trade)
The current `LaunchpadLayout` includes the full `Footer` component (brand, Product links, Resources, Company, copyright). This large footer does NOT appear in the Axiom Pulse screenshot. On the /trade page, the terminal should fill the viewport with only the sticky stats bar at the bottom.

**Fix:** Remove the `<Footer />` from the trade page layout, or conditionally hide it when on /trade.

---

## Files to Modify

### 1. `src/pages/TradePage.tsx`
- Ensure the page renders immediately (layout shell + skeletons) even if hooks are still loading
- Remove padding from main content area for full-width terminal feel
- The Pulse header toolbar code stays as-is

### 2. `src/components/layout/LaunchpadLayout.tsx`
- Add an optional prop `hideFooter` to conditionally hide the big `<Footer />` component
- Remove padding on main when used by trade page (add `noPadding` prop)
- This lets the terminal fill the full viewport like the screenshot

### 3. `src/components/launchpad/AxiomTokenRow.tsx`
- Update creator line fallback: show `launchpad_type` name (e.g., "Pump.fun") instead of truncated wallet address
- Increase MC font size from 13px to 14px for more visual weight
- These are minor refinements to match the screenshot's density

### 4. `src/components/launchpad/CodexPairRow.tsx`
- Same creator line fix as AxiomTokenRow (already uses `launchpadName`, just verify consistency)

### 5. `src/components/launchpad/AxiomTerminalGrid.tsx`
- No structural changes needed -- the grid layout already matches
- Ensure desktop columns fill viewport height (the `pulse-column-scroll` max-height may need adjustment)

### 6. `src/index.css`
- Adjust `.pulse-column-scroll` max-height to account for no footer (use `calc(100vh - 100px)` instead of 140px)
- Fine-tune MC value font weight to be bolder

---

## Summary of What's Untouched
- Left sidebar (Sidebar.tsx) -- 100% untouched
- Top header bar (AppHeader.tsx) -- 100% untouched  
- Sticky stats footer (StickyStatsFooter.tsx) -- 100% untouched
- All data hooks -- 100% untouched
- Routing -- 100% untouched
- Dark theme colors -- 100% untouched

## Summary of What Changes
1. Fix the loading/rendering bug so the page actually shows content
2. Hide the big Footer on /trade (only sticky stats bar should show)
3. Remove main content padding for full-width terminal
4. Minor card text refinements (creator line, MC font size)
5. Adjust column scroll height for full viewport usage
