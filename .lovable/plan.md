

## Plan: Create Landing Page + Move Launchpad

### Overview
1. Rename current `/` (FunLauncherPage) to `/launchpad` route
2. Create a new professional landing page at `/` that showcases Saturn Trading platform
3. Fix XTrackerPage missing header (it uses raw Sidebar but no AppHeader)

### Route Changes (App.tsx)
- Change `"/"` to render new `HomePage` (not `PunchDomainRoot`)
- Add `/launchpad` route pointing to `FunLauncherPage`
- Update sidebar nav: Home → `/`, add "Launchpad" → `/launchpad`
- Keep PunchDomainRoot logic for punchlaunch.fun domain

### New File: `src/pages/HomePage.tsx`
A professional landing page using `LaunchpadLayout` with these sections:

**1. Hero Section**
- Saturn logo + "Saturn Trade" title
- Tagline: "The fastest AI-powered trading terminal on Solana"
- Brief description of platform features (trading terminal, referral system, launchpad)
- CTA buttons: "Open Terminal" → `/trade`, "Launch Token" → `/launchpad`

**2. Mini Pulse Section (limited tokens)**
- Reuse `AxiomTerminalGrid` or build a lightweight version showing only 5 new pairs, 5 final stretch, 5 migrated
- Pass a `limit={5}` prop or slice data before passing

**3. Last 20 Tokens Launched**
- Reuse `useJustLaunched` or `useFunTokensPaginated` hook, show horizontal scroll or grid of 20 token cards

**4. King of the Hill**
- Reuse existing `<KingOfTheHill />` component

**5. Alpha Tracker Section (last 10)**
- Use `useAlphaTrades(10)` hook
- Show compact trade cards in a grid/list

**6. X Tracker Section (last ~6 tweets)**
- Use `useKolTweets()` hook, show first 6 `KolTweetCard` components

**7. Leverage Section (top 6 pairs)**
- Use `useAsterMarkets()` hook, show top 6 by volume
- Compact cards with symbol, price, 24h change, volume

### Fix: XTrackerPage Header
- XTrackerPage uses `Sidebar` directly but doesn't use `AppHeader`
- Add `AppHeader` import and render it like other pages, or switch to `LaunchpadLayout`

### Sidebar Update (Sidebar.tsx)
- Add "Launchpad" nav item with `Plus` or `Rocket` icon pointing to `/launchpad`
- Keep "Home" pointing to `/`

### Files to create/modify:
- **Create**: `src/pages/HomePage.tsx`
- **Edit**: `src/App.tsx` (routes)
- **Edit**: `src/components/layout/Sidebar.tsx` (add launchpad link)
- **Edit**: `src/pages/XTrackerPage.tsx` (add AppHeader)
- **Edit**: `src/components/launchpad/AxiomTerminalGrid.tsx` (add optional `limit` prop)

