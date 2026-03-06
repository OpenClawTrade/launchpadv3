

## Plan: Add Portfolio Page to Wallet Dropdown Menu

### Problem
The wallet dropdown menu (screenshot) has no "Portfolio" option. The user wants a dedicated portfolio view accessible from this menu showing all active token holdings with one-click sell (individually or all at once).

### What will be built

**1. New Portfolio Modal/Page** (`src/components/portfolio/PortfolioModal.tsx`)
- A full-screen modal (consistent with AccountSecurityModal pattern) showing all active holdings
- Each holding row shows: token image, name, ticker, balance, value in SOL, and a **"Sell 100%"** button
- A **"Sell All Positions"** button at the top to dump every holding in sequence
- Uses existing `useUserHoldings` hook to fetch holdings with token data
- Uses existing `useFastSwap` hook (`executeFastSwap`) to execute sells — routes through Meteora (bonding) or Jupiter (graduated) automatically
- Progress indicator showing sell status per token during batch sell
- Holdings with zero balance are already filtered by the query (`gt('balance', 0)`)

**2. Add "Portfolio" menu item to wallet dropdown** (`src/components/layout/HeaderWalletBalance.tsx`)
- Add a new `MenuItem` with a `Wallet` or `Briefcase` icon between "Settings" and "Pulse"
- Opens the PortfolioModal (same pattern as settings/account modals)

### Technical details

- **Sell mechanism**: For each holding, call `executeFastSwap(token, balance, false)` with `isBuy=false`. The token object needs `status`, `mint_address`, `dbc_pool_address` — the holdings query already joins the `tokens` table with these fields (need to add `dbc_pool_address` and `status` to the select).
- **Batch sell**: Sequential execution with a progress state array tracking `idle | pending | success | error` per holding.
- **Holdings query enhancement**: The current `useUserHoldings` select needs `dbc_pool_address`, `virtual_sol_reserves`, `virtual_token_reserves`, `total_supply`, `graduation_threshold_sol`, `market_cap_sol`, `volume_24h_sol`, `holder_count` added to enable constructing a full `Token` object for the swap hook.
- **One-click individual sell**: Each row gets a red "Sell" button that sells 100% of that token's balance.

### Files to create/modify
1. **Create** `src/components/portfolio/PortfolioModal.tsx` — modal with holdings list + sell buttons
2. **Modify** `src/components/layout/HeaderWalletBalance.tsx` — add Portfolio menu item + modal state
3. **Modify** `src/hooks/useLaunchpad.ts` — expand the `tokens` join in `useUserHoldings` to include fields needed for swap execution

