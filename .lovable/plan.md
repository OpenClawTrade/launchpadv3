
## Answer: Yes, Codex is used for BNB charts too

The `CodexChart` component (used in `FunTokenDetailPage.tsx`) takes a `networkId` prop and works for any chain Codex supports — including **BSC (networkId 56)**. So BNB token charts already flow through the same `codex-chart-data` edge function, just with `networkId: 56` instead of Solana's `1399811149`.

### What this means for the pivot
- **Keep Codex** — it's the chart data provider for both BNB and Ethereum (networkId 1).
- The same `codex-chart-data` and `codex-sparklines` edge functions will serve ETH + BNB without any backend changes for charting.
- Only Solana-specific Codex calls (e.g. `codex-filter-tokens` for Solana new pairs feed) become irrelevant — but the chart endpoints stay.

### What stays / what goes

| Codex usage | Status |
|---|---|
| `codex-chart-data` (OHLCV bars) | **Keep** — works for ETH (1) and BNB (56) |
| `codex-sparklines` | **Keep** — works for any EVM chain |
| `codex-filter-tokens` (Solana new pairs) | Remove from active UI (Solana-only) |
| `useCodexNewPairs` (Solana pairs feed) | Remove |

### Action when we resume the pivot
1. Default `networkId` in `useCodexChart.ts` should change from Solana (`1399811149`) to Ethereum (`1`), and callers pass `56` for BNB tokens.
2. `CodexChart` usages in `FunTokenDetailPage` should resolve `networkId` from chain context (`bnb → 56`, `ethereum → 1`).
3. Confirm the `CODEX_API_KEY` secret stays active (per the memory note, an inactive key returns 403/502).

**Bottom line:** Codex stays. We just retarget it from Solana network IDs to ETH (1) and BNB (56). No new chart provider needed.
