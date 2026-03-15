

## Add Live Token Age to Pulse Cards

**Goal**: Show a live-updating token age (countdown since launch) on every token card in both the Pulse terminal (TradePage) and the HomePage Live Pulse section.

### Reference
The uploaded screenshot shows tokens with ages like "2m", "5m", "1m", "23s" displayed prominently. Both card components already show a static age string — but it doesn't live-update. We need to make it tick in real-time.

### What exists today
- **`AxiomTokenRow.tsx`** (Solana tokens in Pulse terminal): Already has `formatAge(token.created_at)` on line 72, displayed on line 131. But it's static — only computed once on render.
- **`CodexPairRow.tsx`** (Codex/BNB tokens in Pulse terminal): Already has `formatAge(token.createdAt)` on line 66, displayed on line 146. Also static.
- **`HomePage.tsx` → `PulseTokenRow`**: Does NOT show age at all currently.

### Plan

**1. Create a `useTickingAge` hook** (`src/hooks/useTickingAge.ts`)
- Accepts a `createdAt` timestamp (ISO string or unix seconds).
- Uses `useState` + `useEffect` with a `setInterval` that ticks every second (for tokens < 1h old) or every 30s (for older tokens).
- Returns a formatted age string like "23s", "2m", "1h", "3d".
- Compact formatting matching existing `formatAge` style.

**2. Create a `<LiveAge>` component** (`src/components/ui/LiveAge.tsx`)
- Thin wrapper around `useTickingAge` that renders the ticking age span.
- Accepts `createdAt: string` and optional `className`.
- This avoids re-rendering the entire card every second — only the age text updates.

**3. Update `AxiomTokenRow.tsx`**
- Replace static `age` variable (line 131) with `<LiveAge createdAt={token.created_at} />`.

**4. Update `CodexPairRow.tsx`**
- Replace static `age` display (line 146) with `<LiveAge createdAt={token.createdAt} isUnixSeconds />` (Codex timestamps are unix seconds).

**5. Update `HomePage.tsx` → `PulseTokenRow`**
- Add the `<LiveAge>` component after the token symbol, showing the live age for each token in the Live Pulse section on the homepage.

### Technical details
- The `LiveAge` component uses its own interval so parent cards don't re-render.
- Interval cadence: 1s if age < 60min, 30s if age < 24h, 60s otherwise — keeps CPU low.
- Format output: `<1s`, `23s`, `2m`, `1h`, `3d`, `2mo` — matching existing style.

