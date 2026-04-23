# PopShiba V4 vs Unicurve — Gap Analysis (CLOSED)

Status as of singleton refactor: **all four architectural gaps closed**. Below
is each gap, the Unicurve behavior, and the matching PopShiba contract that
now mirrors it 1:1.

---

## ✅ Gap 1 — Singleton hook + per-token CURVE_IMPL clones

**Unicurve:** One hook contract (`0xafE7...6880`) serves every launch. Per-token
state lives in EIP-1167 clones of `CURVE_IMPL`, keyed by `poolId`.

**PopShiba (now):**
- `contracts/popshiba/v4/PopBondingHookV4.sol` — singleton, no per-token storage.
  `mapping(PoolId => address) curveOf` resolves to the clone on every swap.
- `contracts/popshiba/v4/PopCurveImpl.sol` — implementation cloned per launch
  (EIP-1167) by the factory. Holds reserves, fee accruals, PoolKey fields,
  graduation flag.

---

## ✅ Gap 2 — Transfer-locked token

**Unicurve:** Token blocks all transfers until the curve calls
`enableTransfers()` post-graduation.

**PopShiba (now):** `PopBondingToken._transfer` reverts when
`!transfersEnabled` unless the sender or `msg.sender` is the curve clone.
Curve calls `enableTransfers()` at graduation, identical to Unicurve.

---

## ✅ Gap 3 — V4 PositionManager LP + dedicated locker

**Unicurve:** Mints LP via the V4 `PositionManager` (`0xbD21...ee9e`) as an
ERC-721 NFT, then transfers the NFT to a dedicated `LP_LOCKER`. The locker
whitelists the PM in its `receive()` so only the PM can push native ETH.

**PopShiba (now):** `PopV4LpLocker.sol`
- Implements `onERC721Received` (accepts the LP NFT).
- `receive()` reverts unless `msg.sender == POSITION_MANAGER` — exact match.
- `claimFees(poolId)` calls `PositionManager.collect`, then splits 50/50
  between creator and protocol treasury (the same split Unicurve uses on
  `claimCreatorFees` / `sweepProtocolFees`).
- `registerLock(poolId, tokenId, curve)` is the curve-only entry point that
  binds a poolId to its locked NFT — equivalent to Unicurve's locker registry.

---

## ✅ Gap 4 — Rich event + view surface

**Unicurve:** `Trade` event has 13 fields (gross/fee/creator/protocol legs,
post-trade reserves, spot price, progress bps, timestamp). Public views:
`quoteBuy`, `quoteSell`, `getPrice`, `curveProgressBps`.

**PopShiba (now):**
- `PopBondingHookV4.Trade(token, trader, isBuy, ethAmount, tokenAmount, fee,
  creatorFee, protocolFee, newRealEth, newRealTokens, priceAfter,
  progressBps, timestamp)` — 13 fields, identical layout.
- `PopCurveImpl.quoteBuy / quoteSell / getPrice / curveProgressBps` — same
  signatures as Unicurve's CURVE_IMPL.

---

## File map (post-refactor)

| File | Role | Unicurve analog |
|------|------|-----------------|
| `PopBondingHookV4.sol` | Singleton hook (CREATE2-mined address) | `0xafE7...6880` |
| `PopCurveImpl.sol` | Per-token state clone | `CURVE_IMPL` |
| `PopBondingToken.sol` | Transfer-locked ERC20 clone | `TOKEN_IMPL` |
| `PopV4LpLocker.sol` | Holds V4 PM LP NFT forever | `LP_LOCKER` |
| `PopBondingFactoryV4.sol` | Wires clones + initializes pool | `FACTORY` |

All five contracts compile under `solc 0.8.26` with `viaIR=true`,
matching Unicurve's compiler profile (the same profile that defeats Panoramix
decompilation and makes selector-matching the only definitive parity proof).
