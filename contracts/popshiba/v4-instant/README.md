# PopShiba V4-Instant — Instant LP Launch

instant-LP token launches on Uniswap V4 (Ethereum mainnet).

## What this is

- **No bonding curve.** Tokens trade on a real Uniswap V4 pool from block 0.
- **Single-sided LP seed.** ~96.17% of the 1B supply is deposited as a
  token-only V4 position above current price.
- **Atomic dev buy.** The creator's initial ETH (≥ 0.001) is swapped against
  that LP in the same transaction, bootstrapping the price.
- **Flat 1.25% fee.** Pool fee = 0; the singleton hook takes 1.25% of every
  swap's input and credits 50/50 to creator and treasury.
- **Permissionless claim.** Creators call `claimCreator(token)` on the hook
  to pull their accrued ETH (+ any fees taken in token).

## Files

| File                  | Role                                                   |
|-----------------------|--------------------------------------------------------|
| `PopInstantToken.sol`    | Minimal ERC20, 1B supply, no transfer restrictions.    |
| `PopInstantHook.sol`     | Singleton V4 hook: 1.25% fee, 50/50 split, claim API.   |
| `PopInstantFactory.sol`  | Atomic launch: deploy token, init pool, seed LP, buy.  |

## Compilation

A separate GitHub Actions workflow (`compile-popshiba-v4-instant.yml`) compiles
these into `supabase/functions/popv4instant-deploy/artifacts/`.

## Deployment flow

1. **Mine hook salt** — `popv4instant-mine-salt` brute-forces a CREATE2 salt
   producing a hook address with the correct permission bits
   (`afterInitialize | beforeSwap | afterSwap | afterSwapReturnDelta`).
2. **Deploy hook + factory** — `popv4instant-deploy` deploys the singleton
   hook at the mined address and the factory pointing to it.
3. **Launch a token** — `popv4instant-launch` builds a Privy-signed tx
   calling `factory.launch{value: initialBuy}(params)`.
4. **Index trades** — `popv4instant-index-trades` reads `Launched`, `FeeAccrued`,
   `CreatorClaimed`, `TreasuryClaimed` events for the UI.
5. **Claim** — `popv4instant-claim` builds the `claimCreator(token)` tx for
   the creator to sign.
