

## Add "Earnings" to Wallet Dropdown — Per-Token Fees & Claim

Add an **Earnings** entry inside the wallet dropdown in `PopshibaTopNav` that opens a Popshiba-styled page listing every token the connected wallet launched, the per-token claimable amount (50% of 1% Uniswap V3 fees ≈ 0.5% of volume), totals, and a per-token claim button + a "Claim all" action.

### What the user will see

- Click wallet pill → dropdown now shows: **Copy address · Earnings · Disconnect**.
- "Earnings" navigates to `/earnings` (new route) styled in the same orange/cream/ink Popshiba aesthetic as the rest of the app.
- Page contents:
  - **Header card**: total lifetime earned (your 50% share), total claimable across all tokens, last claim tx link.
  - **"Claim all"** orange CTA (sequential claims, reuses the existing `CreatorFeesPill` flow).
  - **Tokens table** — one row per launched token with:
    - Token icon + name + ticker
    - Lifetime pool fees / Your share (50%) / Claimable
    - Per-token **Claim** button (disabled when 0)
    - **Sync Pool Fees** button (force-collect)
    - Last claim tx link → Etherscan
  - Empty state if wallet has no launched tokens with a ledger row.

### Technical changes

1. **New page** `src/pages/PopshibaEarnings.tsx`
   - Uses `useAccount()` for the connected EVM wallet (redirect/CTA to connect via Privy if not connected).
   - Joins data from `eth_creator_fee_ledger` (filter `ilike creator_wallet`) with `tokens` table for name/ticker/image (one query per side, mapped client-side by `token_address`).
   - Reuses `useClaimableCreatorFees` for totals + refetch.
   - Per-row claim: `supabase.functions.invoke("eth-claim-creator-fees", { tokenAddress, creatorWallet })`.
   - Per-row sync: `supabase.functions.invoke("eth-collect-fees", { tokenAddress })`.
   - "Claim all": iterates sequentially over rows with `owed > 0` (avoids deployer nonce collisions), shows toast summary.
   - Styling: `bg-pop-cream` page, `border-2 border-pop-ink`, `shadow-[3px_3px_0_hsl(var(--pop-ink))]`, `font-pop-display` headings — mirrors landing template buttons.

2. **Route registration** in `src/App.tsx` (or wherever Popshiba routes live)
   - Add `<Route path="/earnings" element={<PopshibaEarnings />} />`.

3. **Wallet dropdown** in `src/components/layout/PopshibaTopNav.tsx`
   - Insert an **Earnings** menu item between "Copy address" and "Disconnect" using `<Link to="/earnings">` styled identically to the existing items.
   - Closes the menu on click.

### Notes

- Fees are EVM-only (Uniswap V3 LP fee split). No Solana ledger is touched.
- Min-claim guard: per-token claim button disabled when claimable rounds to `0.000000` (matches `EthCreatorControls`).
- No DB migration needed — `eth_creator_fee_ledger` already exposes `SELECT` to public via RLS.
- No new edge functions — reuses `eth-claim-creator-fees` and `eth-collect-fees`.

