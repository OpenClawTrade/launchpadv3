
# Quick Buy SOL Button on Pulse Cards

## Overview
Convert the static "0 SOL" button on each Pulse card into an interactive quick-buy button that purchases the token using the Privy embedded wallet. Clicking it will execute a real on-chain swap (bonding curve via Meteora DBC or graduated via Jupiter) directly from the card -- no navigation to another page needed.

## How It Works
1. User clicks the SOL button on a card
2. A small popover/dropdown appears with preset SOL amounts (0.1, 0.5, 1, 2 SOL)
3. Clicking an amount triggers the swap via the existing `useRealSwap` hook
4. The button shows a loading spinner during the transaction
5. A toast notification confirms success or failure with a Solscan link
6. If the user is not logged in, clicking the button triggers Privy login first

## Technical Details

### File 1: New Component `src/components/launchpad/PulseQuickBuyButton.tsx`
A self-contained button component that:
- Accepts a `FunToken` (or `CodexPairToken`) and converts it to the `Token` shape needed by `useRealSwap`
- Uses `useRealSwap().executeRealSwap()` for on-chain execution
- Uses `useAuth()` to check authentication and trigger login
- Shows a Popover (from Radix) with 4 preset amounts: 0.1, 0.5, 1, 2 SOL
- Shows loading state on the selected amount button
- Displays toast on success/failure
- Stops event propagation so clicking doesn't navigate to the token detail page

### File 2: `src/components/launchpad/AxiomTokenRow.tsx`
- Import and use the new `PulseQuickBuyButton` component
- Replace the static `<div className="pulse-sol-btn">` with `<PulseQuickBuyButton token={token} />`
- The button handles `e.preventDefault()` and `e.stopPropagation()` internally so it won't trigger the parent `<Link>` navigation

### File 3: `src/components/launchpad/CodexPairRow.tsx`
- Same replacement: swap the static SOL button div for `<PulseQuickBuyButton>`
- Pass the CodexPairToken data, mapped to the required shape inside the component

### Type Bridging
The `useRealSwap` hook expects a `Token` type (from `useLaunchpad`), but cards use `FunToken` or `CodexPairToken`. The new component will create a minimal `Token`-compatible object from the card data:

```text
FunToken/CodexPairToken --> minimal Token shape:
  - id, mint_address, ticker, name, status, dbc_pool_address
  - Other fields default to 0/null (not needed for swap execution)
```

### What stays untouched
- `useRealSwap` hook -- no changes
- `useJupiterSwap` hook -- no changes
- `useSolanaWalletPrivy` hook -- no changes
- Sidebar, header, footer -- no changes
- Card layout and styling -- no changes (only the button element is swapped)
