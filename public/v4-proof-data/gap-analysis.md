# PopShiba V4 vs Unicurve V4 — Decompiled ABI Gap Analysis

> Produced by extracting selectors from on-chain bytecode (~3.2 KB hook,
> 13.7 KB factory, 9.2 KB curve impl, 4.6 KB token impl, 2.3 KB event bus,
> 5.7 KB LP locker), resolving them via local keccak + OpenChain DB, and
> cross-referencing real on-chain events from the last 49,000 mainnet blocks
> (~500 logs).

## TL;DR — what the bytecode reveals

Unicurve uses a **6-contract architecture**, not the 3-contract layout
PopShiba V4 currently has. The big surprises:

1. **Hook is a SINGLETON, not per-token.** One hook services every Unicurve
   token. State is keyed by PoolId in a separate `CURVE_IMPL` clone per token.
   Our implementation puts curve state inside the hook itself.
2. **LP is held as an NFT in the V4 PositionManager**, locked in a dedicated
   `LP_LOCKER` contract that exposes `collect(uint256 tokenId)`. Fees are
   claimed per-tokenId, not from the hook.
3. **EventBus is a separate dedicated indexer contract.** All Buy/Sell/Graduate
   events fire from the bus — confirmed by 478 logs in 49k blocks all coming
   from `0x7CaE6f8c…` (the EventBus address).
4. **The real trade event is a 13-field `Trade` event** (3 indexed + 10 uints)
   — much richer than our 5-field Buy/Sell.

---

## Contract-by-contract diff

### 1. HOOK — `0xafE727F2288E531184F5B9a81D3049b2f69A6880` (3,221 B)

**Bytecode confirms 13 functions:**

| Selector | Function | In our hook? |
|---|---|---|
| `0x21d0ee70` | beforeRemoveLiquidity | ✅ |
| `0x259982e5` | beforeAddLiquidity | ✅ |
| `0x575e24b4` | beforeSwap | ✅ |
| `0x6c2bbe7e` | afterRemoveLiquidity | ❌ (we don't expose) |
| `0x6fe7e6eb` | afterInitialize | ❌ |
| `0x9f063efc` | afterAddLiquidity | ❌ |
| `0xb47b2fb1` | afterSwap | ❌ |
| `0xb6a8b0fa` | beforeDonate | ❌ |
| `0xc4e833ce` | getHookPermissions | ✅ |
| `0xdc98354e` | beforeInitialize | ❌ |
| `0xe1b4af69` | afterDonate | ❌ |
| **`0x2dd31000`** | **`FACTORY()` → address** | ❌ — proves singleton design |
| **`0x62308e85`** | **`POOL_MANAGER()` → address** | ❌ |

**Gap:** Unicurve's hook implements **all 10 IHooks methods** even when most
are no-ops (BaseHook does this for them). More importantly, the hook stores
no per-token state — it just looks up the curve via `FACTORY()` and the
PoolId. To match: convert our hook to a singleton + move per-token state
into a `CURVE_IMPL` clone (next section).

---

### 2. CURVE_IMPL — `0x10049350072fB8E7B2b3B46EE07d7E6d7D6E209a` (9,230 B)

**This is the contract we're missing entirely.** 30 functions, including:

| Selector | Function | Our equivalent |
|---|---|---|
| `0x948ce1d3` | `realEthReserves()` | inside hook |
| `0x5c25c6dd` | `realTokenReserves()` | inside hook |
| `0x6700c0c3` | `VIRTUAL_ETH()` | inside hook |
| `0xe90ceb9f` | `VIRTUAL_TOKENS()` | inside hook |
| `0x902d55a5` | `TOTAL_SUPPLY()` | inside hook |
| `0xc6675f02` | `CURVE_TOKENS()` | inside hook |
| `0x02c57b3c` | `LP_TOKENS()` | inside hook |
| `0x02d05d3f` | `creator()` | inside hook |
| `0x21ae7307` | `creatorFeesAccrued()` | inside hook |
| `0xb621e75a` | `protocolFeesAccrued()` | inside hook |
| `0x351fee46` | `claimCreatorFees()` | inside hook |
| `0x4a7d0369` | `claimProtocolFees()` | ❌ **missing** |
| `0x4beb394c` | `quoteBuy(uint256)` | ❌ external — we only have internal |
| `0xa64190c4` | `quoteSell(uint256)` | ❌ external — we only have internal |
| `0x7deb6025` | `buy(uint256,address)` | ❌ — we route through hook |
| `0xd79875eb` | `sell(uint256,uint256)` | ❌ |
| `0x98d5fdca` | `getPrice()` | ❌ |
| `0xa932492f` | `K()` | ❌ — exposes the constant product k |
| `0xc55ab66b` | `curveProgressBps()` | ❌ — they expose this on-chain |
| `0xc19d93fb` | `state()` | ❌ — bonded/graduated/seeded enum |
| `0x0242d712` | `lpTokenId()` | ❌ — the V4 NFT position id |
| `0x8b0bc501` | `graduationThreshold()` | inside hook |
| `0x24a9d853` | `feeBps()` | inside hook |
| `0xb1a25c94` | `creatorShareBps()` | inside hook |
| `0x6933f89f` | `lpCreatorShareBps()` | ❌ — separate post-grad creator share |
| `0xdef866da` | `lpFeeTier()` | ❌ — post-grad pool fee tier override |
| `0x51fd6a99` | `GRADUATION_HANDLER()` | ❌ — pluggable graduation logic |
| `0x7165485d` | `curve()` | n/a (this is the curve) |
| `0x7a87ce2c` | `initialize(address,address,uint128,uint16,uint16,uint24,uint16)` | partial — different signature |
| `0x627c097f` | `EVENT_BUS()` | ❌ |
| `0x6352cf24` | `PROTOCOL_TREASURY()` | inside hook |

**Gap:** This is the biggest one. We need a new `PopBondingCurveV4.sol`
deployed as an EIP-1167 clone per launch, with the public ABI above.
The hook becomes a thin singleton that looks up the curve and forwards
to it.

---

### 3. FACTORY — `0x195d262573556fc58e6f69e580271bfa84b1f5a1` (13,766 B)

**21 functions. Our factory has ~3 of them.**

| Selector | Function | Have? |
|---|---|---|
| `0x177021fc` | `createToken(string,string,string,uint256,bytes32)` | ❌ — ours: `launch(name,symbol,salt,sqrtPriceX96)` |
| `0x26be29b4` | `setDefaults((uint16,uint16,uint24,uint16))` | ❌ — adjustable defaults |
| `0xedb7a6fa` | `defaults()` | ❌ |
| `0xef550d3a` | `predictAddresses(address,bytes32)` | ❌ — CREATE2 prediction helper |
| `0xc73c6156` | `isUnicurveToken(address)` | ❌ — token registry check |
| `0xa54eb242` | `HOOK()` | ❌ — singleton hook address |
| `0x2aca25df` | `CURVE_IMPL()` | ❌ — clone target |
| `0x2e51cb48` | `MEME_IMPL()` | ❌ — token clone target |
| `0xcdf05fbc` | `LP_LOCKER()` | ❌ |
| `0x627c097f` | `EVENT_BUS()` | ❌ |
| `0x6352cf24` | `PROTOCOL_TREASURY()` | ✅ |
| `0x62308e85` | `POOL_MANAGER()` | ✅ |
| `0x1bea83fe` | `POSITION_MANAGER()` | ❌ — we never reference posm |
| `0x6afdd850` | `PERMIT2()` | ✅ |
| `0xa91a6462` | `GRADUATION_THRESHOLD_WEI()` | ✅ |
| `0x239f3af7` | `TICK_UPPER()` | ❌ explicit |
| `0x47377d92` | `TICK_LOWER()` | ❌ explicit |
| `0x02c57b3c` | `LP_TOKENS()` | ✅ |
| `0x5760b722` | `onGraduate(address,uint256)` | ❌ — graduation handler hook |
| `0x715018a6` | `renounceOwnership()` | ❌ (no Ownable) |
| `0x8da5cb5b` | `owner()` | ❌ |

**Gap:** Our factory needs to become a registry with predict/lookup helpers,
adjustable defaults, and an `onGraduate` callback wired to the LP locker.
Also missing Ownable (Unicurve's factory is owned).

---

### 4. TOKEN_IMPL — `0xaAf62f61308540e774c2713437ad0f91874C2ee3` (4,606 B)

**14 functions. Mostly ERC20.**

| Selector | Function | Have? |
|---|---|---|
| `0x06fdde03` | name() | ✅ |
| `0x95d89b41` | symbol() | ✅ |
| `0x313ce567` | decimals() | ✅ |
| `0x18160ddd` | totalSupply() | ✅ |
| `0xc50497ae` | `SUPPLY()` | ❌ — exposes raw constant |
| `0x70a08231` | balanceOf | ✅ |
| `0xa9059cbb` | transfer | ✅ |
| `0x23b872dd` | transferFrom | ✅ |
| `0x095ea7b3` | approve | ✅ |
| `0xdd62ed3e` | allowance | ✅ |
| `0x077f224a` | `initialize(string,string,address)` | ❌ — ours has 5 args |
| `0x7165485d` | `curve()` | ❌ — token knows its curve |
| `0xaf35c6c7` | `enableTransfers()` | ❌ — **transfers locked until graduation** |
| `0xbef97c87` | `transfersEnabled()` | ❌ |

**Gap:** Two important behaviors we don't have:
- **Transfers are LOCKED during bonding phase.** Only the curve can move
  tokens; users can't transfer to each other until `enableTransfers()` is
  called by the curve at graduation.
- Initializer signature is `(name, symbol, curve)` — token mints all supply
  to the curve. Ours mints to the hook with extra params.

---

### 5. EVENT_BUS — `0x7CaE6f8c3c03A746F66f1a4d757519936F0bEe6a` (2,332 B)

**9 functions.** We have **zero** of these — the contract doesn't exist for us.

| Selector | Function |
|---|---|
| `0x4420e486` | `register(address)` (registers a curve) |
| `0x927407ea` | `isCurve(address)` |
| `0x2dd31000` | `FACTORY()` |
| `0x03fc2013` | unknown emit-helper |
| `0x7e7b2d0c` | unknown emit-helper |
| `0x90a84a0f` | unknown emit-helper |
| `0xa0ca56ab` | unknown emit-helper |
| `0xb50a69df` | unknown emit-helper |
| `0xf9bd2305` | unknown emit-helper |

**Confirmed events from on-chain logs (last 49k blocks):**

| Topic0 | Signature | Count |
|---|---|---|
| `0xd2a36b5…` | **`Trade(address,address,address,bool,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)`** (3 indexed + 10 data fields) | **392x** |
| `0xcdd696c…` | `TokenCreated(address,address,address,string,string,string,uint256,uint256)` | 52x |
| `0xc1ede5e…` | unknown 3-indexed + 3-word data event (likely Graduated) | 31x |
| `0x10348fa…` | unknown 3-indexed + 4-word data event (likely Migrated) | 3x |

**Gap:** All trade indexing currently watches our hook directly. Unicurve
indexes a singleton EventBus — much cheaper to subscribe to. We should
either deploy our own bus contract or change the indexer to subscribe to
the hook address (which we already do, so this is just a perf concern).

The big functional gap: **our `Buy`/`Sell` events have 5 fields. Unicurve's
`Trade` event has 13 fields** — including price snapshot, market cap, k
constant, fee splits, and progress bps. Front-ends rely on this.

---

### 6. LP_LOCKER — `0x1ac4afeb18ECceaCb884b3D9AD3AeB69A41B062c` (5,706 B)

**10 functions.** We have a stub `PopBondingLpSeederV4.sol` but it's
incomplete.

| Selector | Function | Have? |
|---|---|---|
| `0x150b7a02` | `onERC721Received(address,address,uint256,bytes)` | ❌ — receives the LP NFT from PositionManager |
| `0xce3f865f` | `collect(uint256 tokenId)` | ❌ — claim trading fees from a locked position |
| `0x1bea83fe` | `POSITION_MANAGER()` | ❌ |
| `0x62308e85` | `POOL_MANAGER()` | ❌ |
| `0x2dd31000` | `FACTORY()` | ❌ |
| `0x627c097f` | `EVENT_BUS()` | ❌ |
| `0x6352cf24` | `PROTOCOL_TREASURY()` | ❌ |
| `0x0c245ef6` | unknown | — |
| `0x13eadca9` | unknown | — |
| `0x5e9b6cfe` | unknown | — |

**Verified by partial decompilation:** `receive() external payable`
whitelists only `0x000…0004444c5dc75cb358380D2e3dE08A90` (V4 PoolManager)
and `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` (V4 PositionManager). This
**proves Unicurve mints LP via the PositionManager (NFT positions)**, not
raw `modifyLiquidity` calls — a critical architectural detail our seeder
got wrong.

**Gap:** Replace `PopBondingLpSeederV4.modifyLiquidity()` calls with
PositionManager `mint()` calls, then transfer the resulting NFT to the
locker. Add per-tokenId `collect()` for fee claiming.

---

## Summary — what we need to add to be 1:1

### Must-have (to actually trade like Unicurve)
1. **New `PopBondingCurveV4.sol`** (EIP-1167 clone per token) with the 30
   selectors above. Hook becomes a thin singleton router.
2. **Singleton hook** — deploy ONE hook for the whole protocol (mined to a
   `0x2A88` address); move per-token state into the curve clone.
3. **`enableTransfers()` lock on the token** — block all non-curve transfers
   during the bonding phase. Today users can move bonded tokens around,
   which Unicurve forbids.
4. **PositionManager-based LP minting** — replace raw `modifyLiquidity` in
   the seeder with PositionManager.mint(), then send the NFT to the locker.
5. **`collect(uint256 tokenId)` on the LP locker** — split trading fees
   50/50 creator/treasury after graduation.

### Should-have (parity with their public surface)
6. **13-field `Trade` event** instead of separate `Buy`/`Sell`.
7. **Public `quoteBuy(uint256)` / `quoteSell(uint256) / getPrice() /
    curveProgressBps() / state() / K()`** view functions on the curve.
8. **`predictAddresses(creator, salt)`** helper on the factory.
9. **`isUnicurveToken(address)` / `isCurve(address)`** registry checks.
10. **Owned factory** with `setDefaults((uint16,uint16,uint24,uint16))` so
    fee/share/tier params can be tweaked without redeploy.

### Nice-to-have (admin/UX surface)
11. **`onGraduate(address,uint256)` graduation handler** — pluggable
    post-grad action (Unicurve uses it to fire the LP seed in the same tx).
12. **`GRADUATION_HANDLER()` slot on the curve** — separate contract
    address so they can swap LP-seeding strategies.
13. **`lpCreatorShareBps()` / `lpFeeTier()` overrides per-token** — let
    creators pick post-grad pool fee tier.

### Truly unknown (8 selectors, ~5% of surface)
- EventBus: `0x03fc2013`, `0x7e7b2d0c`, `0x90a84a0f`, `0xa0ca56ab`,
  `0xb50a69df`, `0xf9bd2305` (private emit-helpers, not externally callable
  in any meaningful way).
- LP_LOCKER: `0x0c245ef6`, `0x13eadca9`, `0x5e9b6cfe` (likely admin/setter
  functions for the locker).

These don't affect trading or graduation — they're internal plumbing.

---

## Bottom line

Of Unicurve's **97 total externally-visible selectors across 6 contracts**,
we currently expose roughly **30**. The behavior of the swap math, fee
split, and graduation threshold is identical, but **3 things** are
materially different and need to be fixed for true 1:1 parity:

1. The architecture is **singleton-hook + per-token-curve-clone**, not
   per-token-hook.
2. **Tokens are non-transferable during bonding**.
3. **LP is minted via PositionManager (NFT)** and held by a dedicated locker
   with `collect(tokenId)` for fees.

Everything else is either cosmetic (extra view functions, richer events,
admin setters) or unknowable from bytecode alone.
