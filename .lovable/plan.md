

# Terminal Page Redesign: Axiom-Style Three-Column Token List

## Overview

Replace the current image-card grid layout on the home/terminal page (`/`) with a high-density, Axiom.trade-inspired three-column list view showing tokens organized by lifecycle stage: **New Pairs**, **Final Stretch** (near graduation), and **Migrated** (graduated tokens).

## Current State
- Home page (`FunLauncherPage.tsx`) uses a 2-5 column grid of `TokenCard` components with large images, descriptions, and bonding progress bars
- Each card is image-heavy (~54% height dedicated to token image)
- Filter tabs: New, Hot, Top, Agents
- Horizontal scroll "Just Launched" row at top
- KingOfTheHill featured section

## Target State (Axiom-style)
- Three vertical columns side-by-side: **New Pairs** | **Final Stretch** | **Migrated**
- Each token is a compact horizontal row (~80-100px tall) with:
  - Small avatar (40px), token name + ticker, age, creator @handle
  - Right-aligned: MC (market cap), Volume, Fee stats, TX count
  - Tiny bonding progress bar inline
  - SOL buy button (teal/green)
  - Social icon row (globe, twitter, telegram, chat, users)
  - Percentage stats row at bottom (DS%, buy/sell ratios)
- No large images, no descriptions -- pure data density
- Dark terminal aesthetic with monospace metrics
- Mobile: stacks to single column with horizontal tab switching between the three categories

## Technical Plan

### 1. Create `AxiomTokenRow` Component
**New file: `src/components/launchpad/AxiomTokenRow.tsx`**

A compact horizontal row component for each token:
- 40px rounded avatar on the left
- Name + ticker + age inline
- Creator @username with avatar (if available)
- Right side: MC and Volume in USD, fees, TX count
- Inline thin progress bar
- Quick-buy SOL button (green pill)
- Bottom stats: bonding %, DS%, buy/sell ratios
- Platform badge (pump, bags, claw) as small icons

### 2. Create `AxiomTerminalGrid` Component
**New file: `src/components/launchpad/AxiomTerminalGrid.tsx`**

Three-column layout component:
- Column headers: "New Pairs", "Final Stretch", "Migrated" with counts
- Each column has filter controls (P1, P2, P3 pagination, sort icon)
- Scrollable columns with virtual list feel
- Data splitting logic:
  - **New Pairs**: tokens sorted by `created_at` desc, `bonding_progress < 80`
  - **Final Stretch**: tokens with `bonding_progress >= 80` and status not graduated
  - **Migrated**: tokens with `status === 'graduated'` or `bonding_progress >= 100`
- Mobile responsive: single column with tab switcher

### 3. Update `FunLauncherPage.tsx`
- Replace the current `TokenCard` grid section with `AxiomTerminalGrid`
- Keep the top "Just Launched" horizontal scroll (or merge into New Pairs column)
- Keep `KingOfTheHill` or optionally remove for cleaner terminal feel
- Remove image-heavy filter tabs, replace with column-based organization
- Keep ticker bar, sidebar, and header untouched

### 4. Add Axiom-specific CSS to `src/index.css`
- `.axiom-row` -- compact row styling with hover highlight
- `.axiom-col-header` -- column header with count badge
- `.axiom-progress-inline` -- thin inline progress bar
- `.axiom-buy-pill` -- green SOL buy button

### 5. Mobile Responsiveness
- Desktop (>1024px): three columns side-by-side
- Tablet (768-1024px): two columns (New + Final Stretch visible, Migrated in tab)
- Mobile (<768px): single column with horizontal tab switcher ("New Pairs" | "Final Stretch" | "Migrated")

## Technical Details

### Token Row Data Layout (per Axiom screenshot)
```text
+-------------------------------------------------------+
| [Avatar] NAME Ticker [badges]     MC $2.39K           |
|          13s [icons] @user 58.6K  V  $504             |
|          [progress bar thin]      F 0.023 TX 3        |
|  0% DS 0% 0% 0% 0%                    [0 SOL btn]    |
+-------------------------------------------------------+
```

### Column Classification Logic
```typescript
// New Pairs: recent, early bonding
const newPairs = tokens.filter(t => 
  (t.bonding_progress ?? 0) < 80 && t.status !== 'graduated'
).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

// Final Stretch: near graduation (80%+)  
const finalStretch = tokens.filter(t => 
  (t.bonding_progress ?? 0) >= 80 && t.status !== 'graduated'
).sort((a, b) => (b.bonding_progress ?? 0) - (a.bonding_progress ?? 0));

// Migrated: graduated tokens
const migrated = tokens.filter(t => 
  t.status === 'graduated'
).sort((a, b) => (b.market_cap_sol ?? 0) - (a.market_cap_sol ?? 0));
```

### Key Styling
- Row background: `hsl(222 30% 7%)` with `hover:hsl(222 25% 10%)`
- Column dividers: 1px `hsl(222 20% 14%)` vertical borders
- MC/Volume: `hsl(160 84% 45%)` for green values
- SOL buy button: teal border pill with SOL amount
- Font: IBM Plex Mono for all numeric data at 11-12px
- Avatar: 40px rounded with 1px border
- Row height: ~90-100px compact

### Files to Create
1. `src/components/launchpad/AxiomTokenRow.tsx` -- individual token row
2. `src/components/launchpad/AxiomTerminalGrid.tsx` -- three-column grid

### Files to Modify
1. `src/pages/FunLauncherPage.tsx` -- swap grid for Axiom layout
2. `src/index.css` -- add Axiom row/column CSS classes

