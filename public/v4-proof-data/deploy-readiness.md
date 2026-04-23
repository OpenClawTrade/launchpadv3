# PopShiba V4 — Production Readiness Checklist

Last updated: after singleton refactor + edge-function rewrite.

## ✅ Code complete (in repo)

| Layer | Status | File(s) |
|------|--------|--------|
| Singleton hook | ✅ | `contracts/popshiba/v4/PopBondingHookV4.sol` |
| Per-token curve clone | ✅ | `contracts/popshiba/v4/PopCurveImpl.sol` |
| Transfer-locked token | ✅ | `contracts/popshiba/v4/PopBondingToken.sol` |
| LP locker | ✅ partial — see ⚠️ below | `contracts/popshiba/v4/PopV4LpLocker.sol` |
| Factory | ✅ | `contracts/popshiba/v4/PopBondingFactoryV4.sol` |
| TS bindings (5 ABIs) | ✅ | `src/lib/ethereum/popshibaV4.ts` |
| `/v4-proof` page | ✅ | `src/pages/V4ProofPage.tsx` |
| Deploy edge function | ✅ | `supabase/functions/popv4-deploy-factory/index.ts` |
| Salt miner edge function | ✅ | `supabase/functions/popv4-mine-salt/index.ts` |
| Launch edge function | ✅ | `supabase/functions/popv4-launch/index.ts` |
| Trade indexer edge function | ✅ | `supabase/functions/popv4-index-trades/index.ts` |
| LP-seed keeper edge function | ✅ caller wired | `supabase/functions/popv4-seed-lp/index.ts` |

---

## ⚠️ Two things are NOT yet ready for mainnet

---

## ⚠️ One thing is NOT yet ready for mainnet

### Solidity artifacts must be compiled with Foundry

Lovable's sandbox cannot run `forge build` reliably (the contracts depend on
`@uniswap/v4-core` and `uniswap-hooks` totalling ~500 MB of Solidity sources).

Run locally:
```bash
cd contracts
forge install Uniswap/v4-core OpenZeppelin/uniswap-hooks
forge build --use 0.8.26 --optimize --optimizer-runs 200 --via-ir
```

Then copy the 5 artifact JSONs into the deploy edge function:
```
out/PopBondingToken.sol/PopBondingToken.json     →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopCurveImpl.sol/PopCurveImpl.json           →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopV4LpLocker.sol/PopV4LpLocker.json         →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopBondingHookV4.sol/PopBondingHookV4.json   →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopBondingFactoryV4.sol/PopBondingFactoryV4.json → supabase/functions/popv4-deploy-factory/artifacts/
```

The current `artifacts/` directory contains **stale bytecode** from the
pre-refactor (per-token-hook) contracts. You MUST rebuild before deploy.

### LP-seed flow — IMPLEMENTED ✅

`PopCurveImpl.seedLockedLP()` and the hook-side `unlockCallback` are now wired
end-to-end:

1. Anyone calls `curve.seedLockedLP(poolId)` (the keeper does this)
2. Curve approves the hook for `LP_TOKENS` and calls `hook.seedLockedLP(poolId)`
3. Hook calls `poolManager.unlock(...)` → enters `unlockCallback`
4. Inside callback:
   - Reads pool `sqrtPrice`, computes full-range `liquidity` via `LiquidityAmounts`
   - Calls `poolManager.modifyLiquidity` with the locker as logical owner (salt = poolId)
   - Settles ETH leg via curve's `drainEthToHook` + `poolManager.settle{value}`
   - Settles token leg via `transferFrom(curve)` + `sync` + `transfer` + `settle`
   - Calls `locker.registerLock(poolId, ...)` so fee claims work
   - Calls `curve.clearReservesAfterSeed()` → unlocks generic ERC20 transfers

The position is held under `(owner=locker, salt=poolId)` on the PoolManager
itself. Since `_beforeRemoveLiquidity` always reverts, the LP is permanently
locked — equivalent to Unicurve's "send NFT to dead address" pattern (V4 core
doesn't issue NFTs, so we lock at the position layer instead).

> ⚠️ **Compile expectation**: this code is written against the published V4
> interfaces but was NOT compiled in the sandbox. After your `forge build`,
> expect 1–2 small fixes (likely import paths for `LiquidityAmounts` — try
> `@uniswap/v4-core/test/utils/LiquidityAmounts.sol` first; if missing, copy
> Uniswap V3's `LiquidityAmounts.sol` and bump the pragma to 0.8.26).



---

## Deploy sequence (when artifacts are ready)

1. Add secrets: `ETH_MAINNET_DEPLOYER_PRIVATE_KEY`, `ETH_MAINNET_RPC_URL`,
   funded with ≥0.05 ETH on the deployer.
2. `POST popv4-deploy-factory { dryRun: true }` → returns predicted addresses + `hookInitCodeHash`.
3. `POST popv4-mine-salt { factory: "0x4e59b44847b379578588920cA78FbF26c0B4956C", initCodeHash }` → returns `{ salt, hookAddress }`.
4. `POST popv4-deploy-factory { salt, hookAddress }` → deploys all 5 contracts and inserts into `bonding_deployments`.
5. Add secrets: `POP_V4_FACTORY_ADDRESS`, `POP_V4_HOOK_ADDRESS` from the response.
6. `POST popv4-launch { name, symbol, creator }` → live token!
7. After 3 ETH on any token: `POST popv4-seed-lp { token }` (currently stubbed).

---

## Frontend launch button

The current launch button still routes to legacy V3 contracts. After the
deploy succeeds, swap the button's edge-function call from `bonding-deploy`
to `popv4-launch`. That's a one-line change once the chain side is live.
