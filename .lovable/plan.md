

## Goal

Finish the "every page = same footer as the iframed landing page" work that was left half-done last loop. The sticky bar (BTC/ETH/BNB tickers, Tracker, + New Pairs, 🚀 Launch, ⚡ Pulse, Stable, ping) and the dark `© 2026 POPSHIBA` band should appear on every page, exactly once, exactly like in `launch.html`.

## What's already correct

`LaunchpadLayout` already renders the canonical trio (`PopshibaTopNav` + content + `PopshibaFooter` + sticky `Footer`) and most pages now go through it. The `PopshibaFooter` component and the sticky `Footer` component are already pixel-matched to the iframe's `<footer>` and `.sfm` markup.

## What's still broken

1. **Build errors** — three Group 2 pages still have `<Footer />` JSX after the `Footer` import was stripped:
   - `src/pages/CreateTokenPage.tsx` (line 144)
   - `src/pages/TrendingPage.tsx` (line 404)
   - `src/pages/AdminPanelPage.tsx` (line 137)

2. **Duplicate sticky bar** — `CareersPage` is wrapped in `LaunchpadLayout` by the route, but still also renders its own `<Footer />` inside the page body, so the sticky bar appears twice and the dark band is missing.

3. **`PopshibaEarnings` (`/earnings`)** — renders `PopshibaTopNav` by hand, has no `PopshibaFooter` and no sticky `Footer`. The `/earnings` route was deliberately skipped last loop; it needs to be wrapped in `LaunchpadLayout` for parity.

4. **`HomePage` (`/preview-old`)** — renders `<Footer />` directly with no `PopshibaFooter` band, and is not wrapped in `LaunchpadLayout`. Wrap it the same way so the preview matches the live landing page.

## Implementation steps

1. **Strip stale JSX** — delete the orphan `<Footer />` lines (and any `{/* Footer */}` comment immediately above) from `CreateTokenPage`, `TrendingPage`, `AdminPanelPage`, `CareersPage`. Also drop `import { Footer } from "@/components/layout/Footer"` from `CareersPage`.

2. **Wrap `PopshibaEarnings`** — replace its hand-rolled `PopshibaTopNav` + outer `<div>` with `<LaunchpadLayout>...</LaunchpadLayout>`; drop the now-unused `PopshibaTopNav` import.

3. **Wrap `HomePage`** — replace its outer `<div>` + manual `<Footer />` with `<LaunchpadLayout>` so `/preview-old` shows the same dark band + sticky bar combo as every other page.

4. **Final sweep** — `grep -rn "from \"@/components/layout/Footer\"" src/pages` to confirm nothing outside `LaunchpadLayout.tsx` still imports the legacy `Footer`, and `grep -rn "<Footer" src/pages` returns nothing. Then `tsc --noEmit` to confirm a clean build.

## Out of scope

- Iframe pages (`/`, `/alpha`, `/x-tracker`) — their footer lives inside `launch.html` and already matches by definition.
- `/widget/:type` (embed widget — must stay chromeless) and `/link/:code` (instant redirect).
- No changes to `PopshibaFooter`, `Footer`, or `LaunchpadLayout` — they are already correct.

