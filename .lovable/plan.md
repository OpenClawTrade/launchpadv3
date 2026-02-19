
## Full Site Audit & Fix Plan

### Issues Identified

**Issue 1: "Create Token" doesn't work**
The Sidebar and AppHeader "Create Token" buttons link to `/launch/solana`, which renders `FunLauncherPage` (the home page) — NOT a token creation form. The `TokenLauncher` component was removed from the home page in the redesign, so clicking "Create Token" just refreshes the home page. Fix: open a `Dialog` with the actual `TokenLauncher` form when clicking "Create Token", or use a dedicated `/create` page with `TokenLauncher`.

**Issue 2: Just Launched shows nothing**
Database confirms most recent token was `2026-02-18 09:29:12` — more than 24 hours ago. The query is correct, but with 0 results the UI shows blank. Fix: display a "No tokens launched in the last 24h" message and expand the window to 48h as fallback.

**Issue 3: All other pages still use old LaunchpadLayout / gate-theme**
19 files across pages use `LaunchpadLayout` or `gate-theme dark` which renders the old TUNA OS header and styles. These pages need wrapping in the new Sidebar layout.

**Issue 4: Favicon and logo**
The uploaded pixel-art lobster image should replace the current favicon AND the sidebar logo (`claw-logo.png`).

---

### Files to Change

#### Group 1 — Fix "Create Token" popup (critical)
- **`src/pages/FunLauncherPage.tsx`** — Add a `Dialog` that contains `TokenLauncher`. Wire the "Create Token" button in the header to open this dialog via state. This is the standard pump.fun pattern — "Create coin" opens a modal form.
- **`src/components/layout/AppHeader.tsx`** — Change "Create Token" `Link` to a `button` that triggers the dialog (via a callback prop or URL param approach).
- **`src/components/layout/Sidebar.tsx`** — Same: change "Create Token" `Link` to open dialog.

Best approach: Use a URL param `?create=1` — when `FunLauncherPage` sees `?create=1` in the URL, it opens the create dialog. Clicking "Create Token" anywhere navigates to `/?create=1`. This keeps routing clean and the dialog opens on any page reload to that URL.

#### Group 2 — Fix "Just Launched" empty state
- **`src/hooks/useJustLaunched.ts`** — Change window to 48 hours as fallback, add a `isEmpty` field. Or keep 24h but pass a fallback: if no 24h results, try 48h.
- **`src/pages/FunLauncherPage.tsx`** — Add empty state message "No tokens launched in the last 24h — check back soon!" when `justLaunchedTokens.length === 0` and not loading.

#### Group 3 — Apply new layout to ALL pages using LaunchpadLayout / gate-theme
Replace `LaunchpadLayout` with the new Sidebar-based layout. The pattern is:
```tsx
<div style={{ background: "#141414" }} className="min-h-screen">
  <Sidebar mobileOpen={...} onMobileClose={...} />
  <div className="md:ml-[160px] flex flex-col min-h-screen">
    <AppHeader />
    <main className="flex-1 p-4">
      {children}
    </main>
    <Footer />
  </div>
</div>
```

**Update `LaunchpadLayout.tsx`** to use this new pattern internally — since all 19 pages import `LaunchpadLayout`, updating the layout component itself fixes ALL pages simultaneously without touching each file.

Pages affected (all fixed by updating `LaunchpadLayout.tsx` once):
- `TunaBookPage`, `TunaPostPage`, `SubTunaPage` (agents/tunabook)
- `AgentDocsPage`, `AgentLeaderboardPage`, `AgentConnectPage`, `AgentDashboardPage`
- `FunTokenDetailPage`, `TradingAgentProfilePage`
- `MigratePage`, `AgentClaimPage`
- Plus: `ApiDashboardPage` (uses `gate-theme dark` directly — needs individual update)
- Plus: `AgentsPage` (uses `gate-theme dark` directly — needs individual update)
- Plus: `OpenTunaPage` (has its own header — needs individual update)
- Plus: `TrendingPage` (has its own header — needs individual update)
- Plus: `WhitepaperPage` (has its own header with arrow back — needs individual update)
- Plus: `LaunchTokenPage` (has its own header — needs individual update)

#### Group 4 — Favicon & Logo Update
- Copy uploaded lobster pixel art to `public/claw-logo.png` (replaces sidebar logo) AND `public/favicon.png` (replaces favicon)
- `index.html` already references `/favicon.png` — just replacing the file is enough
- Sidebar already uses `/claw-logo.png` — just replacing the file fixes both

---

### Detailed Technical Changes

**`src/components/layout/LaunchpadLayout.tsx`** — Complete rewrite:
- Remove old Gate.io header entirely
- Add `Sidebar` + `AppHeader` instead
- Keep `children` render and `Footer`
- Remove `gate-theme dark` wrapper class
- Keep `showKingOfTheHill` prop (just remove the section or render it above children)

**`src/pages/FunLauncherPage.tsx`**:
- Read `?create=1` from URL params — if true, show the `TokenLauncher` dialog on mount
- Add a `Dialog` wrapping `TokenLauncher` component with proper close handler
- The `justLaunchedTokens` empty state: add a pill message "No launches in 24h"

**`src/components/layout/Sidebar.tsx`** & **`src/components/layout/AppHeader.tsx`**:
- Change "Create Token" to `Link to="/?create=1"` instead of `/launch/solana`

**`src/pages/ApiDashboardPage.tsx`**:
- Remove `gate-theme dark` wrapper and `ApiHeader` inline component
- Use `Sidebar` + `AppHeader` directly

**`src/pages/AgentsPage.tsx`**:
- Remove `gate-theme dark` wrapper
- Replace `LaunchpadLayout` with `Sidebar` + `AppHeader`

**`src/pages/OpenTunaPage.tsx`**:
- Replace custom header with `Sidebar` + `AppHeader`

**`src/pages/TrendingPage.tsx`**:
- Replace custom header with `Sidebar` + `AppHeader`

**`src/pages/WhitepaperPage.tsx`**:
- Replace custom header with `Sidebar` + `AppHeader`

**`src/pages/LaunchTokenPage.tsx`**:
- Replace custom header with `Sidebar` + `AppHeader`

---

### Technical Notes

- The `TokenLauncher` component (2891 lines) is not modified — it's just rendered inside a Dialog
- All data hooks, Supabase queries, and realtime subscriptions remain untouched
- The `gate-theme.css` and `tunabook-theme.css` stylesheets still load — they just won't be the visual driver for layouts anymore
- Mobile sidebar stays the same Sheet drawer pattern
- The `MigrationPopup` component referenced in `LaunchpadLayout` stays in the new layout

### Summary of Files to Edit

| File | Change |
|---|---|
| `public/claw-logo.png` | Replace with uploaded pixel lobster |
| `public/favicon.png` | Replace with uploaded pixel lobster |
| `src/components/layout/LaunchpadLayout.tsx` | Replace Gate.io header with Sidebar+AppHeader |
| `src/pages/FunLauncherPage.tsx` | Add create dialog + empty state for Just Launched |
| `src/components/layout/Sidebar.tsx` | "Create Token" → `/?create=1` |
| `src/components/layout/AppHeader.tsx` | "Create Token" → `/?create=1` |
| `src/pages/ApiDashboardPage.tsx` | Remove gate-theme, use Sidebar+AppHeader |
| `src/pages/AgentsPage.tsx` | Remove gate-theme, use Sidebar+AppHeader |
| `src/pages/OpenTunaPage.tsx` | Replace custom header with Sidebar+AppHeader |
| `src/pages/TrendingPage.tsx` | Replace custom header with Sidebar+AppHeader |
| `src/pages/WhitepaperPage.tsx` | Replace custom header with Sidebar+AppHeader |
| `src/pages/LaunchTokenPage.tsx` | Replace custom header with Sidebar+AppHeader |
| `src/hooks/useJustLaunched.ts` | Extend window to 48h fallback |
