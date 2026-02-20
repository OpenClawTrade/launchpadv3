
# Apply Professional Redesign to All Pages

## Problem
The recent visual polish (transparent backgrounds for matrix mode support, semi-transparent sidebar/header) was only applied to `FunLauncherPage.tsx`. All other pages still use opaque backgrounds (`style={{ background: "#141414" }}` or `bg-background`) that block the matrix canvas and don't match the refined aesthetic.

## Strategy: Two-Level Fix

Rather than editing 40+ page files individually, this will use a combination of:
1. **Global CSS override** -- catch ALL pages at once via `.matrix-active` selector
2. **LaunchpadLayout fix** -- fixes 15 pages that use this shared layout
3. **Inline-layout pages** -- update the 8 pages with `style={{ background: "#141414" }}` to remove the inline style (CSS cannot override inline styles)

## Changes

### 1. `src/index.css` -- Strengthen matrix-active overrides
Add a rule that forces ALL `min-h-screen` containers (the universal page wrapper pattern) to have transparent backgrounds when matrix is active. Also override inline styles with a more aggressive selector:

```css
.matrix-active [style*="background"] {
  background: transparent !important;
}
```

This single CSS rule will handle pages using inline `style={{ background: "#141414" }}` without needing to edit each file.

### 2. `src/components/layout/LaunchpadLayout.tsx`
- Remove `style={{ background: "#141414" }}` from the root div
- Replace with `className="min-h-screen"` only (the dark background comes from the CSS variables / html element already)

This fixes **15 pages** at once: TradePage, AgentLeaderboardPage, AgentDashboardPage, BagsAgentsPage, SubTunaPage, TunaPostPage, TunaBookAdminPage, AgentConnectPage, AgentDocsPage, ClaudeLauncherPage, FunModePage, TradingAgentsPage, etc.

### 3. Inline-layout pages -- Remove `style={{ background: "#141414" }}`
These pages duplicate the sidebar+header layout inline instead of using LaunchpadLayout. Remove the inline background style from each:

- `src/pages/TrendingPage.tsx` (line 131)
- `src/pages/WhitepaperPage.tsx` (line 13)
- `src/pages/TokenomicsPage.tsx` (line 80)
- `src/pages/OpenTunaPage.tsx` (line 55)
- `src/pages/AgentsPage.tsx` (line 21)
- `src/pages/PanelPage.tsx` (lines 37, 64)
- `src/pages/ApiDashboardPage.tsx` (lines 415, 607, 622, 733)
- `src/pages/LaunchTokenPage.tsx` (line 11 -- uses `bg-background`)

### 4. Additional standalone pages -- Remove opaque backgrounds
Pages that don't use Sidebar but still have opaque wrappers:

- `src/pages/AgentClaimPage.tsx` -- `bg-background` wrappers
- `src/pages/EarningsPage.tsx` -- `bg-background`
- `src/pages/PortfolioPage.tsx` -- `bg-background`
- `src/pages/PartnerFeesPage.tsx` -- `bg-background`
- `src/pages/InvestigateTokenPage.tsx` -- `bg-background`
- `src/pages/TokenDetailPage.tsx` -- `bg-background`
- `src/pages/VanityAdminPage.tsx` -- `bg-background`
- `src/pages/ApiDocsPage.tsx` -- `bg-background`
- `src/pages/DecompressPage.tsx` -- `bg-background`
- `src/pages/TreasuryAdminPage.tsx` -- `bg-background`
- `src/pages/DeployerDustAdminPage.tsx` -- `bg-background`
- `src/pages/PromoMentionsAdminPage.tsx` -- `bg-background`
- `src/pages/FollowerScanPage.tsx` -- `bg-background`
- `src/pages/ApiBuilderPage.tsx` -- `bg-[#0a0a0c]`
- `src/pages/VanityGeneratorPage.tsx` -- `bg-[#0d0d0f]`
- `src/pages/TwitterBotAdminPage.tsx` -- `bg-[#0d0d0f]`
- `src/pages/GovernancePage.tsx` -- `bg-[#0a0a0b]`

For ALL of these, the `bg-background` / custom bg classes on the root `min-h-screen` div will be handled by the existing CSS `.matrix-active .min-h-screen { background: transparent !important; }` rule. No individual file edits needed for these -- the CSS override handles it.

**However**, the inline `style={{ background: "..." }}` pages (the 8 listed in step 3) MUST be edited because CSS `!important` cannot override inline styles in standard CSS. The aggressive `.matrix-active [style*="background"]` rule in step 1 will handle this.

## Summary

| Change | Pages Fixed |
|--------|------------|
| CSS `.matrix-active [style*="background"]` override | ALL remaining pages with inline styles |
| `LaunchpadLayout.tsx` remove inline bg | ~15 pages using shared layout |
| CSS `.matrix-active .min-h-screen` (already exists) | ~21 pages using `bg-background` class |

**Total: 3 file edits (index.css + LaunchpadLayout.tsx + strengthen existing CSS) to fix every single page.**

The key insight: instead of editing 40+ files, we use CSS specificity to force transparency when matrix mode is active, and the non-matrix appearance stays identical because `html { background: ... }` provides the dark base color.
