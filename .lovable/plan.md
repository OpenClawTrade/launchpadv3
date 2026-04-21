

## Fix incorrect "Uniswap V2" copy on launch page

The "What you actually get on launch" checklist on `/` (rendered in `public/popshiba-template/launch.html`, lines 1153–1159) says **"Instant Uniswap V2 pair"**, but the actual `PopShibaLauncherV2.sol` contract deploys to **Uniswap V3** — 1% fee tier, full-range single-sided LP via the V3 `NonfungiblePositionManager`, with the LP NFT optionally locked in Team Finance.

### Changes (single file: `public/popshiba-template/launch.html`)

Rewrite the four checklist items to match what actually happens on-chain:

1. **"Instant Uniswap V3 pool (1% fee tier)."** — Token is live and tradeable on Uniswap V3 the second the tx confirms. No bonding curve, no graduation, no waiting room.
2. **"Full 1B supply seeded as concentrated LP."** — 100% of supply is paired with your ETH and minted as a full-range V3 position. Zero pre-mine, zero team allocation.
3. **"Optional 10-year LP NFT lock."** — Toggle the locker to time-lock the V3 LP NFT in Team Finance for 10 years (~0.045 ETH locker fee). DEXTools / GMGN / DexScreener show the locked-LP trust badge, and you keep 100% of the 1% swap fees that accrue to the position — it's your pool, not a service fee.
4. **"Renounced & immutable ERC-20."** — Standard clone-factory ERC-20. No owner, no mint, no blacklist, no fee switch, no backdoor.

Also scan the rest of `launch.html` for any other stray "V2 pair" / "Uniswap V2" / "pair" wording in FAQ, hero, or tooltips and update those to "V3 pool" for consistency.

### Why this matters
The contract (`contracts/popshiba/PopShibaLauncherV2.sol`) explicitly uses:
- `IUniswapV3Factory` / `INonfungiblePositionManager` (V3)
- `FEE_TIER = 10000` (1%)
- `TICK_LOWER / TICK_UPPER = ±887200` (full range)
- LP NFT → UNCX/Team Finance lock

So the page was misrepresenting the product. No contract or backend changes needed — pure copy fix.

