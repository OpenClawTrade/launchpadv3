# PopShiba V4-Klik (Klik-Parity Implementation)

This folder contains a 1:1 port of the live, Etherscan-verified Klik.finance V4
contracts (factory `0xDE60796060C24638c389EFbD36b6b919805ca655`,
hook `0x07F17023db9CEc3F8C6Bb53C6940E29Dffb0a0cc`).

The **only** intentional differences vs Klik:

| Layer | Change | Reason |
|---|---|---|
| Hook default fee tiers | Single floor tier `FeeTier(0, 100, 50)` (1.00% total, 50/50 split) | PopShiba business rule |
| Token contract name | `Token` → `PopKlikToken` | Avoid name collision in artifacts |
| Factory contract name | `Factory` → `PopKlikFactory` | Same |
| Factory hook field | `klikHook` → `popHook` | Cosmetic |
| Periphery imports | Klik imports `v4-periphery`, `universal-router`, `permit2` packages. We inline the small subset of interfaces / opcodes we actually need. | Avoid pulling 100 MB of deps into this repo. |

**Everything else is byte-for-byte identical to Klik:**

- LP geometry (sqrtPriceX96, ticks, single-sided 1B-token amount)
- Anti-sniper penalty curve and `penaltyMultiplier=50` halving
- `provideLiquidityV4` flow via official PositionManager (single-sided MINT_POSITION + SETTLE_PAIR)
- `_buyToken` flow via official Universal Router V4_SWAP (zeroForOne ETH→token)
- Fee currency: **ETH always** (creator fees pushed into the token contract via `receive()`, claimed via `Factory.collectFees`)
- Same launch-block guard, 3-block anti-snipe with 2% wallet limit, 10% pool tolerance
- Same Permit2 approval flow, same WETH withdrawal helper

This is the implementation that powers the user-visible launch path, replacing
the older `v4-instant` approximation that lived in `contracts/popshiba/v4-instant/`.
