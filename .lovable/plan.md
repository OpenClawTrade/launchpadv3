

# V3 Launcher with Platform-Owned LP NFT + Creator Fee Split

## Model

- **Pool**: Uniswap V3, **1% fee tier** (tickSpacing 200) — only tier that's economically viable for memecoins
- **LP NFT owner**: **Platform deployer wallet** (`0xc596547700d9175b9807f405bed1a62a386dc1ae`) — NOT the creator
- **Creator never holds the NFT** → can't rug, can't burn, can't transfer
- **Fee split**: Platform calls `collect()` on the NFT → splits collected WETH/token **50/50** between creator wallet and platform treasury
- **Creator earnings UI**: Dashboard shows "Earned" (lifetime 50% share) + "Claimable" (pending) + "Claim" button

## Launch flow (atomic, in `eth-create-token` edge function)

1. Deploy ERC20 (1B supply, minted to platform deployer)
2. Compute `sqrtPriceX96` for chosen launch market cap (default ~$5K)
3. `factory.createPool(WETH, token, 10000)` → `pool.initialize(sqrtPriceX96)`
4. Approve `NonfungiblePositionManager` (`0xC36442b4a4522E871399CD717aBDD847Ab11FE88`)
5. **Single-sided mint**: full token supply, tick range strictly above spot → `recipient: platformDeployer`
6. Optional dev buy: if creator passed `devBuyEth > 0`, swap ETH→token via the new pool, send tokens to creator
7. Insert into DB: `eth_tokens` row + `eth_lp_positions` row (lpTokenId, creator wallet, pool address, owned by platform)

**Min initial liquidity**: 0 ETH required from creator (true single-sided). Optional dev buy capped at 5 ETH.

## Fee accounting

New table `eth_creator_fee_ledger`:
- `token_address`, `creator_wallet`, `lp_token_id`
- `total_collected_weth`, `total_collected_token`
- `creator_share_weth` (50% of collected), `creator_paid_weth`
- `creator_unclaimed_weth = creator_share_weth - creator_paid_weth`

New edge function `eth-collect-fees` (cron-triggered every ~6h, or manual):
- Loops all `eth_lp_positions`
- Calls `positionManager.collect()` on each NFT (signed by platform deployer key)
- Splits proceeds 50/50, updates ledger
- Platform's 50% stays in platform deployer; creator's 50% accrues as `unclaimed`

New edge function `eth-claim-creator-fees` (user-triggered):
- Reads `creator_unclaimed_weth` for the connected creator wallet
- Sends WETH (or unwraps to ETH) from platform deployer → creator wallet
- Updates `creator_paid_weth`

## Files to change

### New
- `supabase/functions/eth-collect-fees/index.ts` — cron + manual collect from all LP NFTs
- `supabase/functions/eth-claim-creator-fees/index.ts` — pay creator their accrued 50%
- DB migration: `eth_lp_positions`, `eth_creator_fee_ledger` tables + RLS (service-role-only writes)

### Modified
- `supabase/functions/eth-create-token/index.ts` — replace V2 logic with V3 single-sided mint, NFT to platform, optional dev buy, insert ledger row
- `src/components/launchpad/EthLauncher.tsx` — remove LP slider; add optional Dev Buy field (default 0); show "Platform owns LP, you earn 50% of all 1% trading fees"
- `src/components/launchpad/EthCreatorControls.tsx` — replace V2 burn/remove with: **Claimable Fees** display + **Claim** button calling `eth-claim-creator-fees`
- `src/pages/FunTokenDetailPage.tsx` — show creator earnings widget if connected wallet === token creator

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Platform key compromised → fees stolen | Existing `BASE_DEPLOYER_PRIVATE_KEY` is already the trust root; same risk profile as current launcher |
| Creator distrust ("you own my LP") | UI states clearly: "LP held in platform vault, fees auto-distributed 50/50, verifiable on-chain" |
| Collect cron fails | Manual "Force collect" admin button + retry logic; fees just keep accruing in the position, never lost |
| Tick math wrong → trades fail | Use audited V3 SDK math (`@uniswap/v3-sdk` `TickMath.getSqrtRatioAtTick`); test on Sepolia first |
| WETH unwrap fails on claim | Send WETH directly if unwrap fails; user can unwrap themselves |

## Test plan

1. Deploy a test token with 0 ETH, 0 dev buy → confirm pool live, tradeable on Uniswap UI
2. Buy 0.01 ETH from Uniswap → confirm fill, fees accrue in NFT
3. Run `eth-collect-fees` manually → confirm WETH lands in platform deployer, ledger updates with creator's 50% share
4. As creator, click "Claim" → confirm WETH/ETH arrives in creator wallet, ledger updates `creator_paid_weth`
5. Deploy with 0.01 ETH dev buy → confirm creator ends with token bag at launch price
6. Verify on Etherscan: pool exists, NFT owner = platform deployer, fees collected match ledger

