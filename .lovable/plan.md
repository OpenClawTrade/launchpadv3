
## Fix Mobile Layout Across All Site Pages

### What's Being Fixed
The sticky stats footer is still clipped on the right on many pages because the CSS class `.sticky-stats-footer` with `padding-left: 160px` (for desktop sidebar offset) is being applied, but the `@media (max-width: 767px)` override in `App.css` may not be winning against inline styles or isn't reaching all cases reliably. Additionally, several pages with inline Sidebar+AppHeader layouts are missing `overflow-x-hidden` on their outer wrapper, which can cause horizontal scroll on mobile.

### Changes

**1. `src/App.css` -- Strengthen mobile footer reset**
- Add `!important` overrides for the footer on mobile to guarantee no sidebar offset leaks through
- Ensure all pages get `overflow-x-hidden` via the global `html, body, #root` rule (already present, confirmed working)

**2. `src/components/layout/StickyStatsFooter.tsx` -- Remove the CSS class dependency entirely**
- The root cause: the component uses `className="sticky-stats-footer"` which applies `padding-left: 160px` from CSS, but the inner wrapper also has `overflow: "hidden"` which clips content before it can scroll
- Fix: Change the inner wrapper from `overflow: "hidden"` to `overflow: "visible"` so the scrollable stats div actually works
- Alternatively: move the `padding-left` logic entirely into inline styles using `useIsMobile` (already imported) so there's zero CSS specificity battle

**3. Pages with inline Sidebar+AppHeader -- Add `overflow-x-hidden` to outer div**
Each of these pages wraps content in `<div className="min-h-screen bg-background">` but is missing `overflow-x-hidden`. Add it to:
- `src/pages/TrendingPage.tsx` (line ~131)
- `src/pages/AgentsPage.tsx` (line ~21)
- `src/pages/ClawSDKPage.tsx` (line ~55)
- `src/pages/TokenomicsPage.tsx` (line ~74)
- `src/pages/PanelPage.tsx` (lines ~38 and ~65)
- `src/pages/FunLauncherPage.tsx` (line ~163)
- `src/pages/ApiDashboardPage.tsx` (lines ~415, ~607, ~622)
- `src/pages/LaunchTokenPage.tsx` (line ~11)

Also add `pb-16` (bottom padding for footer clearance) to the main content area of each page where missing.

### Technical Details

```text
StickyStatsFooter.tsx changes:
  - Line 55: overflow: "hidden" --> overflow: "visible"
    This is the key fix -- "hidden" was clipping the scrollable stats row
  - The className "sticky-stats-footer" stays, CSS handles padding-left

App.css changes:
  - Strengthen the mobile media query to also force max-width: 100vw
    on the footer

Page-level changes (all identical pattern):
  className="min-h-screen bg-background"
  -->
  className="min-h-screen bg-background overflow-x-hidden"
```

### Pages That Will Be Updated (full list)

1. `src/components/layout/StickyStatsFooter.tsx` -- fix overflow clipping
2. `src/App.css` -- strengthen mobile footer rules
3. `src/pages/TrendingPage.tsx` -- add overflow-x-hidden
4. `src/pages/AgentsPage.tsx` -- add overflow-x-hidden
5. `src/pages/ClawSDKPage.tsx` -- add overflow-x-hidden
6. `src/pages/TokenomicsPage.tsx` -- add overflow-x-hidden, responsive title
7. `src/pages/PanelPage.tsx` -- add overflow-x-hidden (both auth states), pb-16 on tab content
8. `src/pages/FunLauncherPage.tsx` -- add overflow-x-hidden
9. `src/pages/ApiDashboardPage.tsx` -- add overflow-x-hidden (all 3 return blocks)
10. `src/pages/LaunchTokenPage.tsx` -- add overflow-x-hidden
11. `src/components/layout/LaunchpadLayout.tsx` -- already fixed (no changes needed)
12. `src/pages/WhitepaperPage.tsx` -- already fixed (no changes needed)

### What Won't Change
- Desktop layout, colors, fonts, content -- completely untouched
- LaunchpadLayout-wrapped pages (already have overflow-x-hidden)
- Standalone pages without sidebar (CareersPage, ApiDocsPage, etc.) -- no sidebar offset issue
