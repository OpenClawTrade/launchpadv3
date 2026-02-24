

# Axiom Pulse 1:1 Redesign Plan for /trade

## Current State
The `/trade` page currently shows a loading spinner with no visible content. The existing card components (`AxiomTokenRow.tsx` and `CodexPairRow.tsx`) have a basic layout that doesn't match the Axiom Pulse screenshot. The page also has a loading/rendering issue that needs to be fixed.

## What Changes (Sidebar + Layout = UNTOUCHED)
Only the main content area inside `LaunchpadLayout` will be modified. The left sidebar, `AppHeader`, `Footer`, and routing remain completely untouched.

---

## Detailed Breakdown from Screenshot Analysis

### 1. Page Header ("Pulse" Title Bar)
The screenshot shows:
- "Pulse" title in bold white, left-aligned
- Two small icons next to "Pulse" (list view icon + settings gear icon)
- Right side: "Display" dropdown button, bookmark icon, monitor icon, sound icon, gear icon, layout icon, count "1 = 1,573" with chevron

**Implementation:** Update `TradePage.tsx` header section to match. Add a toolbar row with icon buttons and a "Display" dropdown (visual only for now).

### 2. Column Headers (per column)
Each of the 3 columns shows:
- Column title: "New Pairs" / "Final Stretch" / "Migrated" in bold white
- Lightning bolt icon with number (e.g., "2")
- P1, P2, P3 tab buttons (small, inline)
- Star/bookmark icon on far right
- Settings/filter icon on far right

**Implementation:** Redesign `PulseColumnHeader` in `AxiomTerminalGrid.tsx` to include lightning icon with count, P1/P2/P3 mini-tabs, star icon, and filter icon.

### 3. Token Card Layout (THE MAIN REDESIGN)
Each card in the screenshot has this exact structure:

**Row 1 (top):**
- Left: 48x48 rounded avatar with green verified dot (bottom-right)
- Center-left block:
  - Line 1: Token name (bold white) + full name italic + link icon
  - Line 2: Age (e.g., "6d") + social icons row (X, people, link, globe, chat, search) + icon counts (e.g., "4666", "511", "1")
  - Line 3: "by @handle" in gray + follower icon + follower count (e.g., "1,379")
- Right block:
  - MC value large bold (e.g., "$25.5K")
  - V value (e.g., "$12K")
  - F value + TX count with green line indicator (e.g., "TX 958")

**Row 2 (bottom, below a subtle separator):**
- Left: graduation % with arrow icon (e.g., "19%") + colored % dots (e.g., "1% 1% 74% 0%")
- Center: "DS" badge + "Paid" green badge
- Right: Blue pill button with lightning icon (e.g., "2 SOL")

**Bottom-left corner:** Shortened address (e.g., "H83K...pump")

### 4. Card Colors and Hover
- Card background: `#121212` (dark)
- Card border: `#222` (subtle)
- Hover: `#22C55E` border glow at ~35% opacity + 1px lift + shadow
- Text: White for names/MC, `#888` for secondary
- Accents: Green `#22C55E` for positive, Red `#EF4444` for negative
- Blue button: `#2563eb` / `#3b82f6`

### 5. Social Icons Row
Each card shows a row of small gray icons:
- X (Twitter) icon
- People/community icon
- Link icon
- Globe icon
- Chat/search icon
- Each with a count next to them

---

## Files to Modify

### File 1: `src/components/launchpad/AxiomTokenRow.tsx` (FULL REWRITE)
Completely rebuild the card to match the Axiom screenshot:
- Increase avatar to 48px with proper rounded corners
- Add detailed social icons row with counts
- Add "by @handle" creator line with follower count
- Add right-side metrics block: MC (large), V (medium), F + TX count with indicator line
- Add bottom row with graduation %, colored metric dots, DS badge, Paid badge
- Add shortened address bottom-left
- Add blue SOL pill button bottom-right
- Match exact font sizes, spacing, and colors

### File 2: `src/components/launchpad/CodexPairRow.tsx` (FULL REWRITE)
Same card redesign as AxiomTokenRow but using Codex data fields:
- Map `marketCap` to MC, `volume24h` to V, `liquidity` to F
- Map `holders` to TX count
- Map `graduationPercent` to progress indicator
- Include all social icons from Codex data (twitter, telegram, website, discord)
- Include "by" creator line
- Shortened address from `token.address`

### File 3: `src/components/launchpad/AxiomTerminalGrid.tsx` (UPDATE)
- Redesign `PulseColumnHeader` to include: lightning icon with count, P1/P2/P3 mini tabs, star icon, filter icon
- Keep existing data logic (column splitting, king of the hill backfill)
- Update skeleton to match new card height (~130px)
- Keep responsive mobile tab switcher

### File 4: `src/pages/TradePage.tsx` (UPDATE)
- Replace "Terminal" header with "Pulse" title matching Axiom
- Add toolbar row with Display dropdown, bookmark, monitor, sound, gear, layout icons
- Keep existing data hooks unchanged

### File 5: `src/index.css` (UPDATE pulse-* classes)
- Update `.pulse-card` padding to `12px 14px`
- Update `.pulse-avatar` to `48px` x `48px` with `border-radius: 12px`
- Add new classes: `.pulse-social-row`, `.pulse-creator-line`, `.pulse-tx-indicator`
- Update `.pulse-col-header` for the new header layout with P1/P2/P3 tabs
- Add `.pulse-metric-row` for bottom metrics with colored dots
- Update `.pulse-sol-btn` padding to `px-5 py-1.5`
- Ensure all hover states match: green glow + lift + shadow

---

## Technical Notes

- All existing data hooks (`useFunTokensPaginated`, `useCodexNewPairs`, `useGraduatedTokens`, `useSolPrice`, `useKingOfTheHill`) remain unchanged
- The sidebar component (`Sidebar.tsx`), layout (`LaunchpadLayout.tsx`), and routing are not touched
- Social icon counts will use available data (holders, volume) - some fields may show 0 if data isn't available from the API
- P1/P2/P3 tabs in column headers will be visual-only for now (no filtering logic)
- The "Display" dropdown in the page header will be visual-only
- The blue SOL button remains a visual element (buy functionality added later)

