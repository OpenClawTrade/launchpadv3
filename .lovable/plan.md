

# BNB Pulse Trading Terminal — Full Chain-Aware Implementation

## Problem
The `/trade` (Pulse terminal) page and all its data feeds are hardcoded to Solana (Codex network `1399811149`). When a user selects BNB in the chain switcher, the Pulse terminal should switch entirely to show BNB tokens — new pairs, completing, migrated — sourced from Codex's BSC network (network ID `56`).

## Approach
Make the entire Pulse pipeline chain-aware: the edge function accepts a `networkId` parameter, the hooks pass it based on chain context, and the TradePage/AxiomTerminalGrid respond to chain switches. The same UI components (CodexPairRow, AxiomTokenRow, sparklines) work for both chains.

## Changes

### 1. Edge Function: `codex-filter-tokens` — Add BSC support
- Accept optional `networkId` parameter (default `1399811149` for Solana)
- When `networkId = 56` (BSC): use BSC-specific launchpad names (e.g. `["Flap.sh", "PancakeSwap"]` or remove launchpad filter entirely to show all BSC pairs)
- Swap `network: [1399811149]` → `network: [networkId]` in all three column queries
- BSC tokens won't have launchpad graduation data, so for BSC "completing"/"completed" columns, use liquidity/volume-based filters instead

### 2. Edge Function: `codex-sparklines` — Add BSC support
- Accept optional `networkId` parameter (default `1399811149`)
- Use it when building token IDs: `${addr}:${networkId}`

### 3. Edge Function: `codex-token-info` — Add BSC support
- Accept optional `networkId` parameter
- Used by the token detail page for external tokens

### 4. Edge Function: `codex-chart-data` — Add BSC support
- Already accepts `networkId` param, just need to pass it from frontend

### 5. Hook: `useCodexNewPairs` — Chain-aware
- Accept `networkId` parameter
- Pass it to `codex-filter-tokens` edge function call
- Include `networkId` in query key so Solana and BNB caches are separate

### 6. Hook: `useSparklineBatch` — Chain-aware
- Accept optional `networkId` parameter
- Pass to `codex-sparklines` edge function

### 7. `TradePage.tsx` — Add chain context
- Import `useChain` to get current chain
- Map chain to Codex network ID (`solana` → `1399811149`, `bnb` → `56`)
- Pass `networkId` to `useCodexNewPairs` and `useSparklineBatch`
- When BNB selected: skip `useFunTokensPaginated` (Solana-only DB tokens) or filter by `chain = 'bnb'`
- Update header to show "Pulse — BNB" when on BNB chain
- Show BNB price instead of SOL price

### 8. `AxiomTerminalGrid` — Accept chain context
- Accept optional `chain` prop to adjust labels (e.g. "New BNB Pairs")
- Quick buy amounts show in BNB instead of SOL when on BNB chain

### 9. `CodexPairRow` — Chain-aware links
- When chain is BNB, link to `/trade/${address}` (same route, token detail page handles it)
- Show BscScan link instead of Solscan for copy/external links

### 10. `FunTokenDetailPage` — BSC token support
- Detect if token address is an EVM address (0x prefix)
- Pass `networkId: 56` to `codex-token-info` and `codex-chart-data`
- Show PancakeSwap swap link instead of Jupiter
- Show BscScan explorer links

### 11. `useBnbPrice` hook (new)
- Fetch BNB/USD price (from CoinGecko or Codex)
- Used when chain is BNB to display USD values

## Files Modified/Created

| File | Action |
|------|--------|
| `supabase/functions/codex-filter-tokens/index.ts` | Add `networkId` param, BSC filter logic |
| `supabase/functions/codex-sparklines/index.ts` | Add `networkId` param |
| `supabase/functions/codex-token-info/index.ts` | Add `networkId` param |
| `src/hooks/useCodexNewPairs.ts` | Accept & pass `networkId` |
| `src/hooks/useSparklineBatch.ts` | Accept & pass `networkId` |
| `src/hooks/useBnbPrice.ts` | New — fetch BNB/USD price |
| `src/pages/TradePage.tsx` | Add chain context, conditional data sources |
| `src/components/launchpad/AxiomTerminalGrid.tsx` | Chain-aware labels & currency |
| `src/components/launchpad/CodexPairRow.tsx` | Chain-aware links & explorer |
| `src/pages/FunTokenDetailPage.tsx` | BSC token detection & routing |

## Build Order
1. Edge functions (add `networkId` param to all Codex functions)
2. Hooks (`useCodexNewPairs`, `useSparklineBatch` — pass networkId)
3. `useBnbPrice` hook
4. `TradePage` — chain-aware data fetching
5. `AxiomTerminalGrid` + `CodexPairRow` — chain-aware UI
6. `FunTokenDetailPage` — BSC token detail support

