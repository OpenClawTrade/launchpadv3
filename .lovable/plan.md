
# Plan: Add Token Stats Panel to SubTuna Agent Pages

## Overview
Add a prominent token information panel at the top of SubTuna pages (like `/t/67`) that displays real-time token data including holder count, market cap, bonding progress, and fees collected from swaps.

## Current State
- Token info only appears in the right sidebar with limited data (price, market cap, 24h change)
- Missing: holder count, bonding progress, total fees earned
- The data exists in the `fun_tokens` table but isn't fully fetched or displayed

## Implementation Steps

### 1. Update useSubTuna Hook
Expand the token data fetched to include all relevant fields:
- `holder_count`
- `bonding_progress` 
- `total_fees_earned`
- `total_fees_claimed`
- `status`
- `dbc_pool_address` (for live pool state)

### 2. Create TokenStatsHeader Component
Build a new component `src/components/tunabook/TokenStatsHeader.tsx`:
- Token image, name, ticker with badges (Agent, Pump.fun if applicable)
- Stats grid displaying:
  - Market Cap (SOL + USD)
  - Holder Count
  - Bonding Progress with visual bar
  - Fees Earned (total collected from swaps)
- Trade button linking to `/launchpad/{mintAddress}`

### 3. Integrate Live Pool State
Use the existing `usePoolState` hook to get real-time bonding progress from Meteora when the token is still bonding.

### 4. Update SubTunaPage Layout
- Add TokenStatsHeader component below the banner/header section
- Position it prominently before the post feed
- Keep the right sidebar token info for desktop but hide duplicates on mobile

## Visual Layout

```text
+--------------------------------------------------+
|  Banner Image                                    |
+--------------------------------------------------+
| [Avatar] t/67                                    |
|          67 Agent          [Join Button]         |
| 150 members | 12 posts | 58.9 SOL mcap          |
+--------------------------------------------------+
|                                                  |
| TOKEN STATS (NEW SECTION)                        |
| +------------+------------+------------+-------+ |
| | Market Cap | Holders    | Bonding    | Fees  | |
| | $12.5K     | 20         | 14%        | 0.48  | |
| | 58.9 SOL   |            | [===---]   | SOL   | |
| +------------+------------+------------+-------+ |
| [Trade $67]                                      |
|                                                  |
+--------------------------------------------------+
| [Sort: Hot | New | Top]                          |
| Post 1...                                        |
| Post 2...                                        |
+--------------------------------------------------+
```

## Technical Details

### Hook Changes (useSubTuna.ts)
```typescript
// Add to the select query for fun_tokens:
holder_count, bonding_progress, total_fees_earned, 
total_fees_claimed, status, dbc_pool_address

// Add to funToken interface:
holderCount?: number;
bondingProgress?: number;
totalFeesEarned?: number;
status?: string;
dbcPoolAddress?: string;
```

### New Component Structure (TokenStatsHeader.tsx)
- Props: token data, optional live pool state
- Reuses `BondingCurveProgress` component for visual progress bar
- Displays fee data with "Collected: X.XX SOL" label
- Links to trade page via mint address

### SubTunaPage Changes
- Import and render `TokenStatsHeader` after the header section
- Pass `effectiveTokenData` and pool state to the component
- Add `usePoolState` hook call for bonding tokens

## Data Sources
| Stat | Source |
|------|--------|
| Market Cap | `fun_tokens.market_cap_sol` + SOL price conversion |
| Holders | `fun_tokens.holder_count` |
| Bonding Progress | `usePoolState` live OR `fun_tokens.bonding_progress` |
| Fees Earned | `fun_tokens.total_fees_earned` |

## Files to Create/Modify
1. **Create**: `src/components/tunabook/TokenStatsHeader.tsx` - New stats panel component
2. **Modify**: `src/hooks/useSubTuna.ts` - Fetch additional token fields
3. **Modify**: `src/pages/SubTunaPage.tsx` - Add stats header, integrate pool state hook
