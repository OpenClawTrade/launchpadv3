# Klik.finance V4 Architecture — Full Reverse-Engineered Reference

**Source:** All 3 contracts verified on Etherscan, fetched via `ETHERSCAN_API_KEY`.
**Goal:** Recreate this model 1:1 for PopShiba on the main launch page, with
fees split **50/50 creator / treasury** (klik uses a tiered split — we override
to a flat 50/50).

---

## Live mainnet addresses

| Role | Address | Verified |
|---|---|---|
| **Factory** | `0xDE60796060C24638c389EFbD36b6b919805ca655` | ✅ |
| **PositionManager (Uniswap V4 official)** | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | ✅ |
| **PoolManager (Uniswap V4 official)** | `0x000000000004444c5dc75cB358380D2e3dE08A90` | — |
| **UniversalKlikHook** | `0x07F17023db9CEc3F8C6Bb53C6940E29Dffb0a0cc` | ✅ |
| **Universal Router** | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` | — |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | — |
| **StateView** | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` | — |
| **WETH** | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | — |

---

## Components, A → Z

### 1. `Token` (per-launch ERC20 — deployed via `new Token{salt}` in factory)

- **Supply:** 1,000,000,000 × 10¹⁸ (1B), all minted to factory at construction
- **Anti-snipe:** during `LAUNCH_PERIOD = 3 blocks` after deploy, max wallet = 2% of supply, with a 10% tolerance for pool→buyer transfers
- **Launch-block guard:** no buys allowed in the deployment block (only platform↔creator transfers)
- **Fees:** Token has `receive() external payable {}` — the **hook** sends the **creator's portion** of swap fees here. Creator (or platform controller) calls `Factory.collectFees(token)` which calls `Token.withdrawFees()` → forwards full balance to factory → factory pays creator.
- `changeCreator(address)` — only callable by factory (which gates on `platformController`)

### 2. `Factory` (single global factory, not cloned per-launch)

Constructor takes the hook address. Holds:
- `klikHook` — current default hook (mutable by `platformController`)
- `tokenHook[token]` — hook used at deploy time for each token (immutable per token)
- `liquidityConfigs[id]` — preset launch configs
  - **Default config 0:**
    - `sqrtPriceX96 = 2505411999795360582221170761428213` (≈ a tick of ~207200, very high price floor)
    - `tickLower = -887200`, `tickUpper = 207200`
    - `amount0Desired = 0` (zero ETH — single-sided)
    - `amount1Desired = 1e27` (full 1B token supply)
    - `virtualAmount = 1 ether`
    - `penaltyMultiplier = 50` (50%)

#### `deployCoin(name, symbol, metadata, salt, configId) payable`
1. CREATE2-deploys a new `Token`
2. Calls `provideLiquidityV4(token, configId)` — initializes pool with `(ETH, token, fee=0, tickSpacing=200, hooks=klikHook)` and mints a single-sided V4 position with the full token supply (no ETH). Position NFT goes to factory (locked there forever — no withdraw function).
3. If `msg.value > 0`, applies an **anti-sniper tax** (`getPenalty`):
   - `< 0.05 ETH` → 0%
   - `0.05 → 0.30 ETH` → linear ramp from 5% to 50%
   - `≥ 0.30 ETH` → 50%
   - Multiplied by `penaltyMultiplier / 100` (default config halves it again → 0–25%)
   - Tax stays in the factory; remainder is swapped via Universal Router for the dev's initial buy and tokens are sent to msg.sender
4. Stores `TokenInfo` and pushes to `creatorTokens[msg.sender]`

#### `collectFees(token) nonReentrant`
- Callable by token's `creator` or `platformController`
- Pulls ETH balance from token via `Token.withdrawFees()` and forwards 100% to the creator
- **Note:** the platform's portion was already taken atomically inside the hook on each swap — that's why the entire token-contract balance is "the creator's portion".

#### `getMarketCap(token)`
- Reads V4 slot0 via StateView, derives `price = (Q96/sqrtP)² × 1e18`, returns `price × totalSupply / 1e18`
- The hook calls this to look up the current mcap and pick a fee tier

### 3. `UniversalKlikHook` (single hook for ALL tokens)

`hooks` field of the PoolKey points here. Address is mined to encode permission bits in the lower 14 bits (`0x...A0CC` etc.).

- **Permissions enabled:** `beforeInitialize`, `beforeSwap` + return delta, `afterSwap` + return delta
- **`beforeInitialize`:** records `poolDeploymentBlock[poolId] = block.number` so the factory's atomic dev-buy in the same tx pays **no fee**
- **`_getFeeSplit(poolId, token)`:** if same block as deploy → 0 fee. Else queries `factory.getMarketCap(token)` and looks up tier
- **Default fee tiers (totalBps / platformBps):**
  | mcap < (ETH) | total | platform | creator |
  |---|---|---|---|
  | 15  | 1.25% | 0.80% | 0.45% |
  | 55  | 1.20% | 0.70% | 0.50% |
  | 90  | 1.15% | 0.60% | 0.55% |
  | 125 | 1.10% | 0.55% | 0.55% |
  | 165 | 1.05% | 0.52% | 0.53% |
  | 365 | 1.00% | 0.50% | 0.50% |
  | 545 | 0.95% | 0.47% | 0.48% |
  | 725 | 0.90% | 0.44% | 0.46% |
  | 910 | 0.85% | 0.41% | 0.44% |
  | 1090 | 0.80% | 0.38% | 0.42% |
  | 1275 | 0.75% | 0.35% | 0.40% |
  | 1450 | 0.70% | 0.33% | 0.37% |
  | 1635 | 0.65% | 0.30% | 0.35% |
  | 1815 | 0.60% | 0.28% | 0.32% |
  | 2000 | 0.55% | 0.27% | 0.28% |
  | 2175 | 0.53% | 0.25% | 0.28% |
  | floor | 0.35% | 0.15% | 0.20% |
- **`beforeSwap`:** for exact-input buys (specified = ETH in), takes `feeBps × ethIn` directly via `poolManager.take(eth, hook, fee)`, returns `BeforeSwapDelta(fee, 0)` so the pool sees less ETH. Splits via `_distributeFee`: platformShare → `platformTreasury.call`, creatorShare → `token.call` (token's `receive()` accumulates it).
- **`afterSwap`:** handles the cases where ETH is the *unspecified* currency (exact-output buys, exact-input sells). Computes `ethMoved` from the delta, takes `feeBps × ethMoved`, returns `int128(fee)` so the pool nets the fee against the user. Distributes same way.
- **exactOutput sells revert** — would need a pre-swap price lookup.
- Owner-only: `setPlatformTreasury`, `setFactory`, `setFeeTiers`, `rescueETH`, `transferOwnership`. Owner is set to `tx.origin` at construction.

---

## What we copy 1:1 vs. what we change for PopShiba

| Component | Klik | PopShiba |
|---|---|---|
| Token (1B supply, 3-block anti-snipe, withdrawFees → factory) | ✅ | **copy verbatim** |
| Factory (single global, single-sided LP, sqrtPriceX96 / ticks, anti-sniper tax curve) | ✅ | **copy verbatim**, just rename + point to our hook |
| Hook permission bits encoded in address | ✅ | **need address-mining** for our hook deployment |
| Fee tier table | 17 tiers, scales 1.25% → 0.35% by mcap | **OVERRIDE → flat 1.00% total, 50/50 split (`totalBps=100, platformBps=50`)** with one floor tier |
| Universal Router for atomic dev buy | ✅ | **copy** |
| Permit2 approvals | ✅ | **copy** |
| LP NFT lock | factory holds the NFT, no withdraw fn | **copy** (or route to `PopV4LpLocker` if you want fee-claim plumbing — klik doesn't have it because all swap fees come from the hook, not the LP position) |

### Recommended PopShiba contract set

1. **`PopKlikToken.sol`** — copy of klik's `Token`, rename, swap branding string
2. **`PopKlikFactory.sol`** — copy of klik's `Factory`, rename, point at our hook + treasury
3. **`PopKlikHook.sol`** — copy of `UniversalKlikHook`, override `_initDefaultFeeTiers` to push a single floor tier `FeeTier(0, 100, 50)` (1% total, 0.5% platform, 0.5% creator) — or two tiers if you want a launch ramp

### Hook deployment requires CREATE2 address mining

The hook address must satisfy `Hooks.validateHookPermissions(hook, perms)` — meaning the lower 14 bits of the address encode which hooks are enabled. With `beforeInitialize | beforeSwap | afterSwap | beforeSwapReturnDelta | afterSwapReturnDelta`, the bitmask is:
- `BEFORE_INITIALIZE_FLAG = 1 << 13` = `0x2000`
- `BEFORE_SWAP_FLAG = 1 << 7` = `0x80`
- `AFTER_SWAP_FLAG = 1 << 6` = `0x40`
- `BEFORE_SWAP_RETURNS_DELTA_FLAG = 1 << 3` = `0x08`
- `AFTER_SWAP_RETURNS_DELTA_FLAG = 1 << 12` = `0x1000`
- **Total: `0x30C8`** → hook address `& 0x3FFF` must equal `0x30C8`

A salt-mining script (off-chain) brute-forces a CREATE2 salt that lands the address on those bits. Klik's hook ends in `...0a0cc` which masks to `0x0CC` — they enabled a slightly different perm set; ours will end in `...30C8`.

---

## Local source dump

Full klik source is at `/tmp/klik/src/` for reference:
- `factory/Factory_whook.sol` (the entire Factory + Token in one file, 693 lines)
- `realhook/src/TaxHook.sol` (the hook, 342 lines)
- `token/token.sol` (verified token source, identical to factory's Token)

---

## Next step

Confirm and I will:
1. Write `contracts/popshiba/v4/PopKlikToken.sol`
2. Write `contracts/popshiba/v4/PopKlikFactory.sol`
3. Write `contracts/popshiba/v4/PopKlikHook.sol` (single 50/50 floor tier)
4. Add a CREATE2 hook-mining edge function `popv4-mine-hook-salt`
5. Add a deploy edge function `popv4klik-deploy` that mines the salt, deploys hook, then deploys factory wired to the hook
6. Wire the existing `/bonding/deploy` page to call the new flow
