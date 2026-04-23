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

### 1. Solidity artifacts must be compiled with Foundry

Lovable's sandbox cannot run `forge build` reliably (the contracts depend on
`@uniswap/v4-core` and `uniswap-hooks` totalling ~500 MB of Solidity sources).

Run locally:
```bash
cd contracts
forge install Uniswap/v4-core OpenZeppelin/uniswap-hooks
forge build --use 0.8.26 --optimize --optimizer-runs 200 --via-ir
```

Then copy the 5 artifact JSONs into both edge functions:
```
out/PopBondingToken.sol/PopBondingToken.json     →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopCurveImpl.sol/PopCurveImpl.json           →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopV4LpLocker.sol/PopV4LpLocker.json         →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopBondingHookV4.sol/PopBondingHookV4.json   →  supabase/functions/popv4-deploy-factory/artifacts/
out/PopBondingFactoryV4.sol/PopBondingFactoryV4.json → supabase/functions/popv4-deploy-factory/artifacts/
```

The current `artifacts/` directory contains **stale bytecode** from the
pre-refactor (per-token-hook) contracts. Deploying with those will produce
broken contracts. You MUST rebuild before deploy.

### 2. The LP-seed flow has a stub

`PopCurveImpl.withdrawForSeed()` and the `seedLockedLP()` function the
keeper calls **are not yet implemented end-to-end**. To actually mint the
post-graduation LP NFT through Uniswap V4's PositionManager, the curve
needs to:

1. Call `PoolManager.unlock(callback)` (the only entry point for LP changes in V4)
2. Inside the callback: `modifyLiquidity` to a full-range tick, settle the
   ETH leg with `settle()`, settle the token leg with `take()`/`sync()`/`settle()`
3. Or alternatively: approve the `PositionManager` and call its `modifyLiquidities`
   batch with `MINT_POSITION` actions (Permit2 required)
4. Transfer the resulting ERC-721 to `PopV4LpLocker`
5. Call `lpLocker.registerLock(poolId, tokenId, address(this))`
6. Call `token.enableTransfers()`

This is ~250 more lines of Solidity and at least one more contract (an
`UnlockCallback` helper). It's the single most error-prone part of any V4
launchpad — every dollar in the LP pool depends on it being right. We
intentionally left it as a stub rather than ship rushed mainnet code.

**Workarounds while LP-seed is pending:**
- The bonding-curve trading phase (pre-graduation) is fully functional; you
  can launch and trade up to the 3 ETH cap.
- Tokens that hit graduation will have their funds safely locked in the
  curve clone (transfers stay disabled — nothing is at risk).
- Once `seedLockedLP` is implemented, anyone can call the keeper to migrate
  any backlog of graduated tokens.

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
