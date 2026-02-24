
# Axiom-Style Trades & Data Tabs for Token Detail Page

## Overview
Add a tabbed section below the chart on each token's detail page (`/launchpad/:mintAddress`) that mirrors the Axiom terminal interface. The tabs will show **Trades**, **Holders**, and **Top Traders** -- all powered by the Codex.io API via new edge functions.

## What Gets Built

### 1. New Edge Function: `codex-token-events`
A backend function that proxies the Codex `getTokenEvents` GraphQL query. It will:
- Accept a token address, optional cursor for pagination, and limit
- Query Codex with `eventType: Swap` filter to only return swap events
- Return normalized trade rows: age/time, type (Buy/Sell), market cap at time, token amount, USD total, trader address, tx hash

### 2. New Edge Function: `codex-token-holders`
A backend function using `top10HoldersPercent` or the `holders` Codex endpoint to fetch holder data for the token. Returns:
- Holder count (already available from `filterTokens`)
- Top holder addresses and percentages (if available on current plan)

### 3. New Hook: `useCodexTokenEvents`
React Query hook that:
- Calls `codex-token-events` edge function with the token address
- Polls every 5 seconds for near-realtime trade updates
- Supports pagination via cursor
- Returns typed trade event array

### 4. New Component: `CodexTokenTrades`
A table component matching the screenshot's Axiom style:
- **Columns**: Age (relative time like "0s", "2s", "10s"), Type (Buy green / Sell red), MC (market cap at time), Amount (token amount), Total USD (colored green/red), Trader (truncated address with copy + Solscan links)
- Dark luxury theme consistent with terminal design
- Auto-scrolling with new trades appearing at the top

### 5. New Component: `TokenDataTabs`
Tabbed container with Axiom-style tab bar:
- **Trades** - Live trade feed (default, with count)
- **Holders (N)** - Holder count from Codex
- **Top Traders** - Placeholder or populated if API plan supports it
- Tabs styled as horizontal text buttons matching screenshot (bold active, muted inactive)

### 6. Update: `FunTokenDetailPage.tsx`
Insert the `TokenDataTabs` component below the chart section in all three layouts (phone, tablet, desktop):
- Desktop: Below the chart in the left 9-column area
- Tablet: Below the chart in the left 7-column area  
- Phone: Visible in the "chart" mobile tab

## Technical Details

### Codex `getTokenEvents` Query Structure
```graphql
{
  getTokenEvents(
    query: {
      address: "<TOKEN_ADDRESS>"
      networkId: 1399811149
    }
    cursor: null
    limit: 50
  ) {
    cursor
    events {
      timestamp
      eventType
      eventDisplayType
      maker
      data {
        ... on SwapEventData {
          amount0
          amount1
          priceUsd
          priceUsdTotal
          type
        }
      }
      transaction {
        hash
      }
    }
  }
}
```

### Edge Function Config
Both new functions will use `verify_jwt = false` (public access, same as other codex functions) and the existing `CODEX_API_KEY` secret.

### Files Created
- `supabase/functions/codex-token-events/index.ts`
- `src/hooks/useCodexTokenEvents.ts`
- `src/components/launchpad/CodexTokenTrades.tsx`
- `src/components/launchpad/TokenDataTabs.tsx`

### Files Modified
- `src/pages/FunTokenDetailPage.tsx` -- Add `TokenDataTabs` below chart in all layouts

### Styling
- Dark background (`#0a0a0a` / `#111`) consistent with terminal theme
- Mono font for all data
- Green for Buy, Red for Sell (matching screenshot colors)
- Compact row height for high-density display
- Truncated trader addresses with copy icon and Solscan external link icon
- Tab bar: horizontal, text-only tabs with active bold styling
