
## Fix /trade — Repair Infinite Loop + Build Real Trading Terminal

### What's broken and why

**Bug 1 — Infinite re-render crash (the console error)**

In `TradePage`, line 97 executes on every render:
```tsx
const targetTime = timer?.target_time ? new Date(timer.target_time) : null;
```
Every render creates a *new* `Date` object, even when `timer.target_time` hasn't changed. The `useCountdown` hook lists `targetTime` as a `useEffect` dependency. React compares by reference — a new object always looks "changed" — so the effect re-fires, calls `setTimeLeft(...)`, which triggers a re-render, which creates another new `Date`... infinite loop.

**Fix:** Derive `targetTime` as a stable string timestamp (not a Date object) and convert *inside* the hook so the reference never changes between renders unless the string itself changes.

**Bug 2 — No actual trading interface**

The countdown timer in the database expired on **2026-02-01** (weeks ago). So `isExpired = true`, and the page shows "Trading is Live!" + a button back to `/`. There is no embedded trading UI. The user clicks "Terminal" in the sidebar and lands on a dead-end screen.

---

### Solution

Replace the dead-end `TradePage` with a full trading terminal that:

1. Fixes the `useMemo`/string-based `targetTime` to eliminate the infinite loop permanently
2. Shows the actual trading interface since the countdown has already expired
3. Embeds the **Jupiter Terminal** via their hosted iframe script (the standard Solana DEX terminal, already used by many projects — zero new dependencies)
4. Keeps the countdown view working correctly for future use if the timer is reset

---

### Implementation

**`src/pages/TradePage.tsx` — full rewrite**

```
Structure:
- useEffect fetches countdown_timers as before
- targetTimeStr derived as string (not Date) using useMemo to stabilise reference
- useCountdown accepts a string, converts to Date internally — no new object each render
- When isExpired (current state): show the Jupiter Terminal iframe embedded in a proper layout
- When not expired: show the countdown card (unchanged visually)
```

The Jupiter Terminal is embedded using their official method:
```html
<script src="https://terminal.jup.ag/main-v3.js" data-preload />
```
Then initialised with:
```js
window.Jupiter.init({
  displayMode: "integrated",
  integratedTargetId: "jupiter-terminal-container",
  endpoint: "<RPC endpoint>",
  defaultExplorer: "Solscan",
});
```

This renders a full-featured swap terminal (SOL ↔ any token) inside a `<div id="jupiter-terminal-container">` on the page. No API key required. No new npm packages.

**Layout when trading is live:**
```
┌────────────────────────────────────────────┐
│  Sidebar (existing)                         │
│  ┌─────────────────────────────────────┐   │
│  │  AppHeader                          │   │
│  ├─────────────────────────────────────┤   │
│  │  "Terminal" title + live badge      │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │  Jupiter Terminal iframe      │  │   │
│  │  │  (full swap UI, any token)    │  │   │
│  │  └───────────────────────────────┘  │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

**Files changed:**

| File | Change |
|---|---|
| `src/pages/TradePage.tsx` | Fix infinite loop; replace expired state with embedded Jupiter Terminal |

No database changes. No new dependencies. No edge function changes.

---

### Technical details

- `targetTime` will be derived with `useMemo(() => timer?.target_time ?? null, [timer?.target_time])` — a string, stable reference
- `useCountdown` accepts `string | null` and creates the `Date` object internally via `useMemo` so it never causes dependency churn
- Jupiter Terminal script is loaded dynamically via `useEffect` (appending a `<script>` tag) and cleaned up on unmount — safe with React's strict mode and lazy route loading
- The RPC endpoint passed to Jupiter will be the public Solana mainnet endpoint (`https://api.mainnet-beta.solana.com`) — no secrets required
- The countdown card for future use keeps the same visual design as today
