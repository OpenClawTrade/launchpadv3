# PopShiba Bonding — own clone of Unicurve.fun (Ethereum mainnet)

A clean-room equivalent of the Unicurve.fun bonding-curve protocol. Same
math, same fee economics, same user-facing behaviour, but **all contracts
are owned and deployed by PopShiba** — no dependency on Unicurve.

## Contracts (deploy in this order)

| # | Contract | Purpose |
|---|----------|---------|
| 1 | `PopBondingToken.sol`   | ERC20 implementation cloned per launch (1B fixed supply) |
| 2 | `PopBondingCurve.sol`   | Bonding curve implementation cloned per launch |
| 3 | `PopEventBus.sol`       | Central event sink (TokenCreated / TradeExecuted / Graduation) |
| 4 | `PopLpLocker.sol`       | Seeds Uniswap V3 1% pool at graduation, sends LP NFT to `0xdEaD` |
| 5 | `PopBondingFactory.sol` | `createToken()` entrypoint — clones token + curve via CREATE2 |
| 6 | `PopEventBus.setFactory(factory)` | Wire bus → factory |

## Math (bit-identical to Unicurve.fun)

| Param | Value |
|---|---|
| Total supply              | 1,000,000,000 |
| Curve allocation          | 792,857,143 |
| LP allocation             | 207,142,857 |
| Virtual ETH               | 1.06 ETH |
| Virtual tokens            | 1,073,000,000 |
| Graduation threshold      | 3 ETH real reserves |
| Trade fee                 | 1% on ETH leg |
| Fee split                 | 50% creator / 50% protocol |
| Post-grad LP              | Uniswap V3 1% pool, full-range, NFT burned to 0xdEaD |

## Differences vs Unicurve

- Unicurve uses Uniswap **V4** with a custom Hook for post-graduation routing.
  V4 hooks require a CREATE2-mined address with specific bit flags AND a
  separately deployed singleton-aware hook contract. We use **Uniswap V3**
  instead — same locked-LP guarantee, simpler deployment, identical UX.
- Unicurve's LP_LOCKER holds the position NFT (claimable LP fees).
  Ours sends it straight to `0xdEaD` → fees accumulate but are unclaimable
  forever (=true permanent burn). If you want claimable LP fees instead,
  replace `DEAD` in `PopLpLocker.sol` with the locker's own address and add
  a `collectFees()` that splits 50/50 to creator + treasury.

## Compile

```
solc 0.8.26
optimizer: enabled, runs: 200
viaIR: true
evmVersion: cancun
```

Foundry:
```bash
forge build --use 0.8.26 --optimize --optimizer-runs 200 --via-ir
```

## Deploy

Same workflow as `eth-deploy-contracts`: paste the runtime bytecode of each
contract into `supabase/functions/eth-deploy-contracts/bonding_bytecode.ts`,
then call the `bonding` mode of the deploy panel.

## Mainnet dependencies (immutable, well-known)

| Address | Purpose |
|---|---|
| `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | WETH9 |
| `0x1F98431c8aD98523631AE4a59f267346ea31F984` | Uniswap V3 Factory |
| `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` | Uniswap V3 NonfungiblePositionManager |
