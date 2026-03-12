

## Plan: Fix BNB Chain Trade Page — Stop Solana-Only Services & Fix UI

### Problems
1. **`fetch-token-holders` 500 error** — Helius (Solana RPC) called with `0x` BSC addresses
2. **`rugcheck-report` 502 error** — RugCheck.xyz is Solana-only, fails on BSC addresses
3. **Wrong trade panel** — `ExternalTokenView` renders `UniversalTradePanel` (Jupiter/Solana) for BSC tokens instead of `BnbTradePanel`
4. **Hardcoded Solscan links** — `CodexTokenTrades` tx links and `HoldersTable` wallet links point to solscan.io for BSC tokens
5. **"SOL Bal" column header** — HoldersTable shows "SOL Bal" regardless of chain

### Changes

#### 1. `src/pages/FunTokenDetailPage.tsx` — ExternalTokenView trade panel fix
- In all 3 layouts (mobile/tablet/desktop), replace `UniversalTradePanel` with `BnbTradePanel` when `isBsc=true`
- Pass `isBsc` prop to `TokenDataTabs`

#### 2. `src/components/launchpad/TokenDataTabs.tsx` — Disable Solana-only fetches for BSC
- Accept `isBsc` prop
- Pass `enabled: !isBsc` to `useTokenHolders` so Helius isn't called for BSC addresses
- Pass `isBsc` down to `CodexTokenTrades` and `HoldersTable`

#### 3. `src/components/launchpad/CodexTokenTrades.tsx` — Chain-aware tx links
- Accept `isBsc` prop
- Change tx link from hardcoded `solscan.io/tx/` to `bscscan.com/tx/` when `isBsc`

#### 4. `src/components/launchpad/HoldersTable.tsx` — Chain-aware wallet links & labels
- Accept `isBsc` prop
- Change wallet links from `solscan.io/account/` to `bscscan.com/address/`
- Change funding source links similarly
- Change "SOL Bal" header to "BNB Bal" when `isBsc`

#### 5. No API changes needed
- RugCheck is only used inside `UniversalTradePanel` and `TradePanelWithSwap` — since BSC tokens will now use `BnbTradePanel`, the rugcheck call is already avoided
- No new API needed; the existing Codex integration handles BSC chart + token info correctly

