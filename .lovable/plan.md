

# UNCX LP Locking Integration

Replace the current "send LP NFT to PopShibaFeeVault" flow with "lock LP NFT in UNCX V3 Locker, with PopShibaFeeVault as the designated fee collector". Result: every newly-launched token shows a recognized **🔒 LP Locked via UNCX** badge on DEXTools / GMGN / DEXScreener the moment it goes live, while creators still earn 50% of the 1% swap fees.

## Why this works

UNCX's `UNCX_LiquidityLocker_UniV3` (`0xFD235968e65B0990584585763f837A5b5330e6DE` on Ethereum) accepts a Uniswap V3 NFT and lets the locker owner specify a separate **`collector` address** that can call `collect()` and stream fees out at any time. Liquidity itself is locked until the unlock date (we'll set 100 years). Every major scanner reads this contract directly and renders the lock badge automatically.

## Architecture change

```text
BEFORE                              AFTER
──────                              ─────
Launcher                            Launcher
  ├─ deploys clone                    ├─ deploys clone
  ├─ creates V3 pool                  ├─ creates V3 pool
  ├─ mints LP NFT → FeeVault          ├─ mints LP NFT → self
  └─ FeeVault.registerToken(...)      ├─ approves NFT to UNCX
                                      ├─ UNCX.lock(nft, collector=FeeVault, unlockDate=+100y)
                                      └─ FeeVault.registerLockedToken(token, lockId, creator)

FeeVault.collect(token)             FeeVault.collect(token)
  └─ NPM.collect(lpTokenId, self)     └─ UNCX.collect(lockId, self, max, max)
```

Everything else (50/50 split, `claim()`, platform auto-forward, creator UX) stays identical.

## Work items

### 1. New smart contracts (deploy once to mainnet)
- **`PopShibaLauncherV2.sol`** — same interface as v1 but:
  - keeps the freshly-minted NFT,
  - calls `IERC721(NPM).approve(UNCX, lpTokenId)`,
  - calls `IUNCX_LiquidityLocker_UniV3.lock(LockParams{ nftPositionManager, nft_id, dustRecipient=creator, owner=FeeVault, additionalCollector=address(0), collector=FeeVault, countryCode=0, feeName="DEFAULT", r=[] , unlockDate=type(uint256).max or now+100y })`,
  - reads back the returned `lock_id`,
  - calls `FeeVault.registerLockedToken(token, lockId, creator)`,
  - emits the same `Launched(token, pool, lpTokenId)` event PLUS new `LpLocked(token, uncxLockId, unlockDate)`.
- **`PopShibaFeeVaultV2.sol`** — same storage/claim logic, but `collect(token)` calls UNCX's `collect(lockId, address(this), MAX, MAX)` instead of NPM's `collect`. Adds `lockId` to `TokenInfo`. Keeps existing `claim()`, `creatorOwed`, 50/50 split, treasury auto-forward, all view methods.
- UNCX charges a fixed ETH fee (~0.0001 ETH at writing) per lock. Launcher forwards this from the user's `msg.value`. Add `uncxLockFeeWei` to launch params returned by `eth-create-token`.

### 2. Backend (`supabase/functions/eth-create-token/index.ts`)
- Add `uncxLockFeeWei` to the response so the frontend can include it in `totalValue` sent with the tx.
- Insert the V2 launcher / vault addresses into `eth_deployments` (new row, keep old row for legacy reads).
- Pass V2 launcher address from now on.

### 3. Frontend (`src/components/launchpad/EthLauncher.tsx`)
- No UX change. Internally:
  - Update `POPSHIBA_LAUNCHER_ABI` to V2 (extra event field).
  - Add `uncxLockFeeWei` to `totalValue` calculation.
  - After launch, store `uncxLockId` from the new event in the success payload sent to `eth-launch-finalize`.

### 4. Backend (`supabase/functions/eth-launch-finalize/index.ts`)
- Accept and persist `uncxLockId` (new column `uncx_lock_id` in `eth_launch_requests`).

### 5. Database
- Migration: `ALTER TABLE eth_launch_requests ADD COLUMN uncx_lock_id NUMERIC NULL;`
- Migration: insert new V2 deployment row in `eth_deployments` (filled in after on-chain deploy).

### 6. Trust-page link (small UX win)
- After launch, in the success card, add a "🔒 View Lock on UNCX" button → `https://app.uncx.network/services/lock-liquidity/uniswap-v3/lock/{lockId}`.

## Costs

| Item | Cost |
|---|---|
| One-time deploy of LauncherV2 + FeeVaultV2 | ~$60–120 gas (mainnet) |
| Per-launch extra gas (UNCX call) | +~120k gas (~$0.40 at current prices) |
| Per-launch UNCX fee | ~0.0001 ETH (~$0.30) — forwarded from creator's tx |
| **Total extra creator cost** | **<$1 per launch** |

## Migration / safety

- Existing live tokens stay on V1 FeeVault — no change, no risk.
- V2 is opt-in by virtue of being a separate launcher contract; we just point the backend at it.
- Old `claim()` calls for existing creators continue to work against V1 vault.

## Out of scope (deliberate)

- Not changing the 50/50 fee split.
- Not adding Etherscan auto-verify in this round (separate task — happy to follow up after V2 ships).
- No change to dev-buy, $5 LP test minimum, or any other existing parameter.

## Confirmation needed before coding

- Lock duration: **100 years** (effectively permanent) vs **`type(uint256).max`** (truly permanent, what Clanker uses). I'll use `type(uint256).max` unless you say otherwise.
- Pass UNCX fee to creator (default) or absorb it from platform treasury. Default = creator pays — matches the rest of the model.

