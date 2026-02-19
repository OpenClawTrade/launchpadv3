
# Replace /trade with Advanced Trading Hub

## What's Happening Now

The `/trade` route (`TradePage.tsx`) loads a Jupiter Terminal — a third-party external swap widget. This is not the platform's own designed trading interface.

The actual **advanced trading UI** already exists: it's `FunTokenDetailPage` at `/launchpad/:mintAddress`, which shows the full token header, stats ribbon, bonding curve bar, trade panel, wallet sidebar, and more.

The user wants `/trade` to be an **advanced trading hub** where you can:
1. Browse and search tokens launched on the platform
2. Select a token
3. Trade it using the existing advanced trading interface

## The Plan

### 1. Redesign `src/pages/TradePage.tsx`

Replace the Jupiter Terminal page entirely with a new **Trading Hub** layout inside `LaunchpadLayout`. The page will:

**Header section:**
- Title: "Trade" with a "Live" badge (matching the platform's mono/terminal aesthetic)
- Subtitle: "Select a token to start trading"
- Search bar to filter tokens by name or ticker

**Token grid/list:**
- Pull all tokens from the existing `useLaunchpad()` hook (same data source as the home page)
- Show filter tabs: All · Bonding · Graduated · Hot
- Each token card shows: image, name, ticker, price in SOL, market cap, 24h volume, bonding progress (if bonding), status badge
- Clicking a token card navigates to `/launchpad/:mintAddress` — the full advanced trading page

**No countdown, no Jupiter Terminal** — those are removed entirely.

### 2. Keep the countdown logic as a soft gate (optional)

Since the `countdown_timers` table with `trade_launch` record exists, we can optionally keep the countdown gate to show the hub only when `isExpired`. But since the user is asking to show the trading hub now, the countdown will be removed and the hub shown directly.

### 3. Sidebar label stays "Terminal"

No change needed to `Sidebar.tsx` — the label "Terminal" already points to `/trade`.

## Files Changed

| File | Change |
|---|---|
| `src/pages/TradePage.tsx` | Full replacement — remove Jupiter Terminal, add token search + grid that links to `/launchpad/:mintAddress` |

## Visual Layout

```text
/trade  ─────────────────────────────────────────
 [Terminal]   [Live ●]
 Select a token to start advanced trading

 [Search tokens...]

 [All] [Bonding] [Graduated] [Hot]

 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ 🪙 $PEPE │ │ 🐸 $FROG │ │ 🚀 $MOON │
 │ $0.0012  │ │ $0.0008  │ │ $0.0034  │
 │ MC: $12K │ │ MC: $8K  │ │ MC: $34K │
 │ ▓▓▓▓░ 65%│ │ ░░░░░ 12%│ │ GRADUATED│
 └──────────┘ └──────────┘ └──────────┘
        ↓ click any token ↓
 /launchpad/:mintAddress  (existing full trading UI)
```

## Technical Notes

- Uses `useLaunchpad()` hook already in the codebase — no new data fetching needed
- Same filtering/sorting logic as the home `FunLauncherPage` (hot score, bonding, graduated tabs)
- Token cards link to `/launchpad/:mintAddress` using `react-router-dom`'s `Link`
- Styled consistent with the platform's dark mono aesthetic (`#0a0a0a`, `#111`, `#222`, `font-mono`)
- Removes all Jupiter Terminal code (the `JupiterTerminal` component, the `useCountdown` hook, the countdown DB fetch) — cleans up the file significantly
- Keeps `LaunchpadLayout` as the wrapper for consistent sidebar/header/footer
