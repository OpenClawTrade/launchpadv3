

# Professional Codex.io Trading Chart -- Implementation Plan

## Overview

Replace the current `DexscreenerChart` iframe embed with a fully custom, professional-grade trading chart powered by **Codex.io Growth plan** (WebSocket subscriptions + full OHLCV endpoints) and **@tradingview/lightweight-charts** (already installed v5+).

The new chart will be a drop-in replacement in `FunTokenDetailPage.tsx`, matching the Axiom.trade / Binance Pro aesthetic.

---

## Prerequisites

1. **Store CODEX_API_KEY as a secret** -- needed for the edge function proxy (Codex requires auth header; cannot expose key client-side)
2. **No new npm dependencies needed** -- `lightweight-charts` is already installed. We will use native `WebSocket` + `fetch` for GraphQL (no Apollo/urql needed for this use case)

## Architecture

The Codex API key must NOT be exposed client-side. All data flows through an edge function proxy:

```text
Browser <--> Edge Function (codex-chart-data) <--> Codex GraphQL API
                                                    (graph.codex.io/graphql)

Browser <-- native WebSocket --> wss://graph.codex.io/graphql
            (key passed via edge function handshake token - OR -
             we proxy via edge function for security)
```

**Decision**: For WebSocket subscriptions, the Codex API key is sent as a connection param. Since we cannot expose it client-side, the edge function will handle both:
- **REST proxy**: Historical OHLCV bars via `getTokenBars` query
- **WebSocket proxy**: Not practical in edge functions. Instead, we will poll the edge function every 5 seconds for the latest bar when the user is actively viewing (simulating real-time). True WebSocket subscriptions can be added later with a dedicated WebSocket server.

**Alternative (simpler, recommended for v1)**: Use short polling (5s interval) for live bar updates via the edge function. This provides near-real-time feel without WebSocket complexity.

---

## Files to Create

### 1. `supabase/functions/codex-chart-data/index.ts`
Edge function that proxies Codex GraphQL queries. Accepts:
- `query`: "getTokenBars" or "getBars"  
- `tokenAddress` / `pairAddress`
- `networkId`: 1399811149 (Solana)
- `resolution`: "1", "5", "15", "60", "240", "1D", etc.
- `countback`: number (max 1500)
- `from` / `to`: Unix timestamps
- `currencyCode`: "USD" or "TOKEN"
- `statsType`: "FILTERED" or "UNFILTERED"

Returns the OHLCV arrays (o, h, l, c, t, volume, buyVolume, sellVolume, etc.)

### 2. `src/hooks/useCodexChart.ts`
React hook that:
- Fetches historical bars via the edge function on mount and timeframe change
- Polls for latest bar every 5 seconds (auto-refresh simulation)
- Caches last 5 timeframes via React Query
- Transforms Codex response format (parallel arrays) into lightweight-charts format (array of objects)
- Exposes: `bars`, `isLoading`, `latestBar`, `resolution`, `setResolution`, `chartType`, `setChartType`, `currencyCode`, `setCurrencyCode`, `statsType`, `setStatsType`

### 3. `src/components/launchpad/CodexChart.tsx`
The main chart component. Props:
- `tokenAddress: string`
- `networkId?: number` (default 1399811149 for Solana)
- `height?: number`
- `defaultResolution?: string`

Features:
- **Toolbar** (top): Timeframe buttons (1s, 5s, 15s, 30s, 1m, 5m, 15m, 30m, 1h, 4h, 12h, 1D, 7D, 1W), chart type dropdown (Candlestick/Line/Area), USD/TOKEN toggle, Filtered/Unfiltered toggle, volume pane toggle, fullscreen button
- **Chart area**: lightweight-charts candlestick series with volume histogram pane below
- **Crosshair tooltip**: OHLC + volume + buy/sell volume breakdown
- **Auto-fit on load**, smooth zoom/pan, price line with label
- **Loading skeleton** matching chart shape
- **Error/fallback** with "Data delayed" banner
- **Dark theme**: #0a0a0a background, #22C55E green, #EF4444 red
- **Mobile responsive**: toolbar collapses to scrollable row

### 4. `src/components/launchpad/CodexChartToolbar.tsx`
Extracted toolbar component for cleanliness:
- Resolution buttons with active glow
- Chart type selector
- Currency toggle
- Filter toggle
- Fullscreen button
- Auto-refresh indicator

---

## Files to Modify

### 5. `src/pages/FunTokenDetailPage.tsx`
- Replace `DexscreenerChart` import with `CodexChart`
- Update `ChartSection` to render `<CodexChart tokenAddress={token.mint_address} />` instead of `<DexscreenerChart>`
- Remove `DexscreenerChart` import

### 6. `src/components/launchpad/index.ts`
- Add export for `CodexChart`

---

## Technical Details

### Codex GraphQL Query (proxied by edge function)

```graphql
query GetTokenBars($tokenAddress: String!, $networkId: Int!, $resolution: String!, $countback: Int, $from: Int, $to: Int, $currencyCode: String, $statsType: TokenBarStatsType, $removeEmptyBars: Boolean) {
  getTokenBars(
    symbol: $tokenAddress
    from: $from
    to: $to
    resolution: $resolution
    countback: $countback
    currencyCode: $currencyCode
    statsType: $statsType
    removeEmptyBars: $removeEmptyBars
  ) {
    o h l c t v
    volume buyVolume sellVolume
    buys sells buyers sellers traders transactions
    liquidity
  }
}
```

The response returns parallel arrays: `o: [float]`, `h: [float]`, etc. The hook transforms these into `{ time, open, high, low, close, volume }[]` for lightweight-charts.

### Resolution Mapping

| UI Label | Codex Resolution |
|----------|-----------------|
| 1s | 1S |
| 5s | 5S |
| 15s | 15S |
| 30s | 30S |
| 1m | 1 |
| 5m | 5 |
| 15m | 15 |
| 30m | 30 |
| 1h | 60 |
| 4h | 240 |
| 12h | 720 |
| 1D | 1D |
| 7D | 7D |
| 1W | 1W |

### Solana Network ID in Codex
`1399811149`

### Color Palette
- Background: `#0a0a0a`
- Grid: `rgba(255,255,255,0.03)`
- Candle up: `#22C55E` (green-500)
- Candle down: `#EF4444` (red-500)
- Volume up: `rgba(34,197,94,0.15)`
- Volume down: `rgba(239,68,68,0.12)`
- Crosshair: `rgba(255,255,255,0.1)`
- Text: `rgba(255,255,255,0.5)`
- Active timeframe glow: `0 0 8px rgba(34,197,94,0.4)`

### Keyboard Shortcuts
- `1`-`9` for timeframe shortcuts
- `F` for fullscreen toggle
- Handled via `useEffect` with `keydown` listener

### Performance
- Use `countback: 1500` with proper `from`/`to` to stay within Codex limits
- React Query with `staleTime: 30000` for caching
- Poll interval: 5 seconds for live bar updates (only when tab is visible via `document.hidden` check)
- Unsubscribe/stop polling on unmount

---

## Implementation Order

1. Store `CODEX_API_KEY` secret
2. Create `codex-chart-data` edge function + deploy
3. Create `useCodexChart` hook
4. Create `CodexChartToolbar` component
5. Create `CodexChart` component  
6. Update `FunTokenDetailPage` to use `CodexChart`
7. Update exports in `index.ts`

