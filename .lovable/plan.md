
Goal: make token balances on `/trade/:mint` update immediately after Quick Buy (no page refresh), and stop false `0` sell balances.

What I found
- Your tx `3SDG...` shows wallet `9knr...` received `+187,859.478758 BREAD`, so on-chain balance is real.
- The UI still showing `Bal: 0.0000` points to client-side balance sync gaps, not swap failure.
- There are two fragile spots in current code:
  1) wallet source mismatch (`solanaAddress` from auth vs embedded wallet actually used for swap),
  2) several balance reads still take only the first token account instead of summing all accounts for that mint.

Implementation plan

1) Unify wallet source for trading/balance reads
- File: `src/hooks/useTurboSwap.ts`
- Return the embedded wallet address from the wallet hook (same signer used in swaps), not only `useAuth().solanaAddress`.
- Keep fallback to auth address only if needed.

- File: `src/components/launchpad/TradePanelWithSwap.tsx`
- Use embedded `walletAddress` from `useSolanaWalletWithPrivy()` for balance refresh guards (replace `solanaAddress` checks in polling/refresh).
- Keep authentication checks for UI/login, but do not block token polling on `solanaAddress`.

2) Make token balance reads robust (all token accounts, not first only)
- File: `src/components/launchpad/PulseQuickBuyButton.tsx`
- In `quick-sell-balance` query and sell preflight read: sum all `getParsedTokenAccountsByOwner` results for mint.
- Parse `uiAmount` with fallback to `uiAmountString` to avoid null/precision edge cases.

- File: `src/components/launchpad/UniversalTradePanel.tsx`
- Replace first-account read (`resp.value[0]`) with summed balance logic (same as above).

- File: `src/hooks/useSolanaWalletPrivy.ts`
- Harden `getTokenBalance` reducer with `uiAmountString` fallback + numeric guards.

3) Make trade-page balance refresh fast and continuous while open
- File: `src/components/launchpad/TradePanelWithSwap.tsx`
- Keep immediate refresh on mount + trade type change.
- Increase refresh aggressiveness while panel is open (e.g. every 2–3s), plus refresh on:
  - window focus,
  - visibility return,
  - post-trade staged refreshes (already present; keep and align timing).
- Preserve last known non-zero value on transient RPC errors (avoid flicker back to 0).

4) Share optimistic buy state across components
- File: `src/components/launchpad/PulseQuickBuyButton.tsx`
- Continue optimistic set after buy, but write to the same balance query key used by trade panel.
- Use staged invalidation (short + medium delay) so UI flips instantly, then reconciles with on-chain truth.

Technical details (concise)
- No backend/database changes required.
- Affected files:
  - `src/hooks/useTurboSwap.ts`
  - `src/hooks/useSolanaWalletPrivy.ts`
  - `src/components/launchpad/PulseQuickBuyButton.tsx`
  - `src/components/launchpad/TradePanelWithSwap.tsx`
  - `src/components/launchpad/UniversalTradePanel.tsx`

Validation checklist after implementation
1) Buy from Quick Buy on token card.
2) Open `/trade/7qFR78PvrhMEF4BcdRxaRrAFQB5ChEwcAFkdBoCGpump` immediately.
3) Confirm sell balance updates without page refresh (within polling window, usually seconds).
4) Click `Sell 100%` and confirm it uses non-zero amount (no “No tokens to sell” when holdings exist).
5) Verify behavior on both bonding and external-token routes.
