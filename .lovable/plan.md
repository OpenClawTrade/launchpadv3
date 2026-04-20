
Goal: remove all Solana branding and Solana-facing product flows from the app, keep the BNB launchpad, and replace the current non-BNB “create” path with an Ethereum create flow.

Assumptions for implementation
- I will hide/remove Solana from the UI and routing first, without deleting legacy Solana database data.
- I will keep Bitcoin only if it does not conflict with your request; if you want BNB + ETH only, I can remove BTC in the same pass.
- For Ethereum create, I will reuse the existing EVM launch flow pattern and repurpose the current Base launcher into an Ethereum launcher unless you want a different ETH contract model.

What I found
- Solana is still the default chain in `ChainContext`, `/launch` still redirects to `/launch/solana`, and many launch/terminal screens are Solana-first.
- The header, chain switcher, footer, market widgets, launcher page, and token create page all still contain Solana-specific logic/branding.
- Privy is configured for both Ethereum and Solana, with Solana embedded wallets and Solana RPC runtime config.
- The backend has many Solana edge functions, but BNB launch already exists and there is already an EVM create function (`base-create-token`) that can be adapted for Ethereum.

Implementation plan

1. Remove Solana from navigation, routing, and default chain
- Update `src/contexts/ChainContext.tsx` so Solana is no longer the default/primary option.
- Change `/launch` redirect in `src/App.tsx` from Solana to BNB or ETH (based on your preferred default).
- Remove Solana from `ChainSwitcher`, header behavior, and route sync logic.
- Make launch routing support only the chains you want exposed.

2. Remove Solana branding and UI references
- Update `src/config/branding.ts` and `supabase/functions/_shared/branding.ts` to remove Solana wording from tagline/description.
- Remove `SolPriceDisplay` usage from the header and swap to BNB/ETH-only price displays.
- Replace Solana-specific helper text like “Switch to Solana to launch now” and “~0.02 SOL” across launcher screens.
- Remove Solana icon/logo usage from chain selectors and launch CTAs.

3. Convert the create page to BNB + Ethereum only
- Refactor `src/pages/CreateTokenPage.tsx` so it renders:
  - `BnbLauncher` for BNB
  - a new Ethereum launcher for ETH
- Remove `TokenLauncher` from this page, since it is heavily Solana/Phantom/Privy-Solana based.
- Reuse the current Base launcher component pattern as the starting point for Ethereum create.

4. Add Ethereum create flow
- Create or repurpose an EVM launcher component for Ethereum based on the existing `BaseLauncher`.
- Point it to an Ethereum-specific edge function instead of Base.
- Update labels, explorer links, network checks, and wallet switching so it targets Ethereum mainnet cleanly.

5. Simplify wallet/auth configuration to EVM-first
- Refactor `src/providers/PrivyProviderWrapper.tsx` to remove Solana connectors, Solana RPC config, Solana embedded wallet creation, and Solana wallet list entries.
- Keep Ethereum embedded wallet support and existing BNB EVM support.
- Leave the Solana wallet hooks in code only if needed temporarily for non-launch legacy pages; otherwise remove imports/usages from active surfaces.

6. Remove Solana-only surfaces from active product pages
- Refactor `FunLauncherPage`, `AppHeader`, `StickyStatsFooter`, and related launchpad/market widgets so they no longer show Solana-only feeds, labels, or states.
- Keep BNB widgets where they already exist.
- For ETH, add a minimal create-only presence first if no full ETH market data/indexer exists yet.

7. Backend cleanup strategy
- Keep legacy Solana tables/data untouched unless you explicitly want destructive cleanup.
- Stop the frontend from calling Solana-only functions such as `sol-price`, `fetch-sol-balances`, bags/pump/Jupiter/Helius-driven features.
- Do not delete backend functions in the first pass unless they are confirmed unused after UI removal; safer to disable usage first, then optionally delete.

8. Ethereum backend work
- Add an Ethereum token creation edge function by adapting the existing EVM deploy flow (`base-create-token`) to Ethereum mainnet.
- Update any shared EVM wallet/network utilities to support both chain IDs 1 and 56 cleanly.
- Keep BNB create logic unchanged.

9. QA after implementation
- Verify `/launch`, `/launchpad`, header, sidebar, chain switcher, and create page show no Solana branding anywhere.
- Verify BNB create still works.
- Verify ETH create flow opens, validates wallet/network, and points to the correct explorer/network.
- Verify no active page tries to fetch Solana runtime config or render Solana price/widgets.

Likely files to change
- `src/contexts/ChainContext.tsx`
- `src/hooks/useChainRoute.ts`
- `src/App.tsx`
- `src/components/launchpad/ChainSwitcher.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/components/layout/StickyStatsFooter.tsx`
- `src/pages/CreateTokenPage.tsx`
- `src/pages/FunLauncherPage.tsx`
- `src/providers/PrivyProviderWrapper.tsx`
- `src/config/branding.ts`
- `supabase/functions/_shared/branding.ts`
- new Ethereum launcher component + new Ethereum create edge function

Important note
This is a broad cleanup because Solana is deeply wired into the current product. The safest rollout is:
1) remove Solana from visible UI/routes,
2) switch create flow to BNB + ETH,
3) then prune leftover Solana code/functions once the app is stable.
