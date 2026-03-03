

## Problems Identified

From the screenshot, the main page still looks nothing like the template because:

1. **Matrix background is still rendering** — green Japanese characters visible behind everything. The `ConditionalMatrixBackground` in App.tsx only suppresses it on `/launchpad/`, `/punch`, and `/trade` — NOT on `/` (home page).

2. **FunLauncherPage uses `md:ml-[160px]`** (line 140) instead of `md:ml-[48px]` — sidebar offset was never updated in this page. Same problem exists in **8 other pages** (WhitepaperPage, TrendingPage, TokenomicsPage, ClawSDKPage, ApiDashboardPage, AgentsPage, PanelPage, LaunchTokenPage).

3. **Matrix mode CSS** (lines 522-554 in index.css) forces backgrounds transparent with `!important`, overriding the dark theme colors — this is why cards look semi-transparent with the matrix showing through.

4. **Token cards still use old blue/teal colors** — `lt-card` uses `hsl(215 28% 13%)` backgrounds and `hsl(187 80% 53%)` (teal) hover borders instead of the chartreuse accent.

5. **Token card ticker color** is hardcoded teal `hsl(187 80% 55%)` instead of using `--primary` (chartreuse).

6. **MatrixModeContext defaults to `true`** — new visitors see matrix by default.

## Plan

### 1. Kill the Matrix background globally
- Change `MatrixModeContext` default from `true` to `false` 
- Update `ConditionalMatrixBackground` to always return `null` (or simply remove the matrix import and rendering from App.tsx entirely)
- Remove the `.matrix-active` CSS rules that force transparent backgrounds

### 2. Fix sidebar offset on ALL pages
- Replace all `md:ml-[160px]` with `md:ml-[48px]` across 9 files:
  - FunLauncherPage.tsx
  - WhitepaperPage.tsx, TrendingPage.tsx, TokenomicsPage.tsx
  - ClawSDKPage.tsx, ApiDashboardPage.tsx, AgentsPage.tsx
  - PanelPage.tsx, LaunchTokenPage.tsx

### 3. Rebrand token cards to chartreuse
- Update `lt-card` CSS in index.css: change background gradient to use dark `#0d0d0f`-based colors, border to use `hsl(var(--border))`, hover border to chartreuse
- Update `TokenCard.tsx`: change ticker color from teal to `hsl(var(--primary))`, update all hardcoded teal/blue references to use CSS variables

### 4. Update LaunchpadLayout offset
- Already fixed to 48px — confirm it's correct

### Files to modify (~12 files):
- `src/contexts/MatrixModeContext.tsx` — default to false
- `src/App.tsx` — remove ConditionalMatrixBackground entirely
- `src/index.css` — remove `.matrix-active` rules, update `lt-card` to chartreuse theme
- `src/components/launchpad/TokenCard.tsx` — swap teal hardcodes to chartreuse/primary
- 9 page files — fix `md:ml-[160px]` → `md:ml-[48px]`

