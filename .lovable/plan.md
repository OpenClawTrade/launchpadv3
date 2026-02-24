

# Pump.fun New Pairs via Codex filterTokens API

## Overview
Add a live "New Pairs" feed to the `/trade` terminal that pulls recent Pump.fun token launches from across the entire Solana network using the Codex.io `filterTokens` GraphQL API. This data will be fetched through a new backend function (proxied through the existing Codex API key) and displayed in the existing "New Pairs" column of the Axiom terminal grid.

## How It Works
The Codex `filterTokens` query supports launchpad-specific filters. We can query for:
- **New (bonding)**: `launchpadName: ["Pump.fun"], launchpadCompleted: false, launchpadMigrated: false`
- **Completing (near graduation)**: `launchpadName: ["Pump.fun"], launchpadGraduationPercent: {gte: 50}, launchpadMigrated: false`
- **Graduated (migrated)**: `launchpadName: ["Pump.fun"], launchpadMigrated: true`

All scoped to Solana network `1399811149`. The response includes token name, symbol, address, market cap, volume, holders, launchpad graduation percent, image URL, and more.

## Technical Plan

### 1. New Edge Function: `codex-filter-tokens`
Create `supabase/functions/codex-filter-tokens/index.ts` that:
- Accepts a POST body with `{ column: "new" | "completing" | "completed", limit: number }`
- Builds the appropriate `filterTokens` GraphQL query with pump.fun filters
- Uses the existing `CODEX_API_KEY` secret (already configured)
- Returns normalized token data with: address, name, symbol, marketCap, volume24h, holders, graduationPercent, imageUrl, createdAt, launchpadName
- Includes CORS headers for web app access

GraphQL query structure:
```text
{
  filterTokens(
    filters: {
      network: 1399811149
      launchpadName: ["Pump.fun"]
      launchpadCompleted: false
      launchpadMigrated: false
    }
    rankings: { attribute: createdAt, direction: DESC }
    limit: 50
  ) {
    results {
      createdAt
      holders
      liquidity
      marketCap
      circulatingMarketCap
      volume24
      change24
      token {
        info { address name symbol imageSmallUrl }
        launchpad {
          graduationPercent
          poolAddress
          launchpadName
          completed
          migrated
        }
      }
    }
  }
}
```

### 2. New React Hook: `useCodexNewPairs`
Create `src/hooks/useCodexNewPairs.ts` that:
- Uses `@tanstack/react-query` to poll the edge function every 30 seconds
- Returns `{ newPairs, completing, graduated, isLoading, error }`
- Maps Codex response to a `CodexPairToken` interface compatible with the terminal grid

### 3. New Terminal Column Component: `CodexPairRow`
Create `src/components/launchpad/CodexPairRow.tsx`:
- Renders similarly to `AxiomTokenRow` but for external Codex tokens
- Shows: token image (from Codex `imageSmallUrl`), name, ticker, market cap (formatted as K/M), graduation %, holder count
- Clicking opens the token on the platform's detail page or links externally (since these aren't platform-native tokens)

### 4. Update `AxiomTerminalGrid`
Modify `src/components/launchpad/AxiomTerminalGrid.tsx` to:
- Accept an optional `codexNewPairs` prop
- Merge Codex Pump.fun pairs into the "New Pairs" column (shown above platform-native tokens, or in a sub-section)
- Add a small "PumpFun" badge/icon to distinguish external pairs from native platform tokens

### 5. Update `TradePage`
Modify `src/pages/TradePage.tsx` to:
- Call the `useCodexNewPairs` hook
- Pass the data to `AxiomTerminalGrid`

## Files to Create
- `supabase/functions/codex-filter-tokens/index.ts` -- edge function proxying Codex filterTokens
- `src/hooks/useCodexNewPairs.ts` -- React Query hook for fetching/polling
- `src/components/launchpad/CodexPairRow.tsx` -- row component for Codex pairs

## Files to Modify
- `src/components/launchpad/AxiomTerminalGrid.tsx` -- integrate Codex pairs into columns
- `src/pages/TradePage.tsx` -- wire up the new hook
- `supabase/config.toml` -- add verify_jwt config for new function (if not already covered by wildcard)

## Notes
- The `CODEX_API_KEY` is already configured as a secret
- Solana network ID in Codex is `1399811149` (already used for charts)
- No new database tables needed; this is a live API feed
- Cache can be added later via the existing `pool_state_cache` pattern if rate limits become an issue

