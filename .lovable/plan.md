
## Add Sticky Stats Footer with "Connection is Stable" Indicator

### What We're Building

A thin, always-visible sticky bar pinned to the bottom of every page showing:
- **TOKENS** | **AGENTS** | **FEES CLAIMED** (SOL) | **AGENT POSTS** | **PAYOUTS** (SOL) — pulled live from `useClawStats`
- **● Connection is stable** — a green pulsing dot + text on the right end, indicating the app is connected

Matches the reference images exactly: dark background, monospaced uppercase labels, white bold values, green connection dot.

### Files to Create / Modify

**1. Create `src/components/layout/StickyStatsFooter.tsx`** (new component)

A `fixed bottom-0 left-0 right-0 z-50` bar (height ~40px) with:
- Left/center: stat items separated by `|` dividers — `TOKENS 0 | AGENTS 0 | FEES CLAIMED 0.00 SOL | AGENT POSTS 0 | PAYOUTS 0.00 SOL`
- Right side: `● Connection is stable` with a green animated pulse dot
- Background: `#111114`, border-top `#2a2a2a`, monospace font matching the terminal aesthetic
- Data sourced from `useClawStats` hook (already exists)
- `md:ml-[160px]` offset to respect the sidebar width

**2. Modify `src/components/layout/LaunchpadLayout.tsx`**

Import and render `<StickyStatsFooter />` as a sibling outside the scrollable layout div — it needs to be at the document root level (fixed positioning), so we add it directly inside the outer `<div>` wrapper.

Add `pb-10` (or similar bottom padding) to `<main>` so page content doesn't get hidden behind the sticky bar.

**3. Modify `src/pages/AgentsPage.tsx`** and any other pages that don't use `LaunchpadLayout`

AgentsPage builds its own layout manually (Sidebar + AppHeader + main + Footer). We add `<StickyStatsFooter />` there too, and add bottom padding to `<main>`.

### Technical Details

Stats data (already available via `useClawStats`):
- `totalTokensLaunched` → TOKENS
- `totalAgents` → AGENTS  
- `totalAgentFeesEarned` (SOL) → FEES CLAIMED
- `totalAgentPosts` → AGENT POSTS
- `totalAgentPayouts` (SOL) → PAYOUTS

Connection status: use a simple `useState(true)` initialized as stable. Optionally hook into `navigator.onLine` + `window` `online`/`offline` events to reflect real network status.

### Visual Spec (from reference images)

```text
[ TOKENS 0  |  AGENTS 0  |  FEES CLAIMED 0.00 SOL  |  AGENT POSTS 0  |  PAYOUTS 0.00 SOL         ● Connection is stable ]
```

- Height: ~40px
- Font: monospace, uppercase labels in `#888`, bold white values
- SOL values formatted to 2 decimal places
- Green dot `bg-green-500` with `animate-pulse`
- "Connection is stable" text in green
- Full-width, offset by sidebar on desktop (`md:pl-[160px]`)
