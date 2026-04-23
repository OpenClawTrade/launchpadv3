// PopShiba Bonding — runtime bytecode for the 5 implementation contracts.
//
// HOW TO FILL THIS FILE
// 1. Compile contracts/popshiba/bonding/*.sol with:
//      solc 0.8.26, optimizer enabled (200 runs), viaIR: true, evmVersion: cancun
//    e.g. via Foundry:
//      forge build --use 0.8.26 --optimize --optimizer-runs 200 --via-ir
// 2. For each contract, copy the **deployment** bytecode (object) — NOT runtime —
//    and paste below as a `0x…` hex string.
// 3. Set BONDING_BYTECODE_READY = true.
//
// The deployer edge function will:
//   - deploy TOKEN_IMPL, CURVE_IMPL, EVENT_BUS, LP_LOCKER (constructor args
//     for LpLocker: WETH, V3Factory, V3PosMgr, BondingFactory-placeholder),
//     then FACTORY (constructor args: tokenImpl, curveImpl, eventBus, lpLocker, treasury),
//     then call EVENT_BUS.setFactory(factory).
//
// Mainnet immutables passed by the deployer:
export const WETH9            = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const UNI_V3_FACTORY   = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const UNI_V3_POS_MGR   = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

export const BONDING_BYTECODE_READY = false;

export const POP_BONDING_TOKEN_BYTECODE   = "0x" as `0x${string}`;
export const POP_BONDING_CURVE_BYTECODE   = "0x" as `0x${string}`;
export const POP_EVENT_BUS_BYTECODE       = "0x" as `0x${string}`;
export const POP_LP_LOCKER_BYTECODE       = "0x" as `0x${string}`; // constructor: (weth, v3factory, v3posmgr, bondingFactory)
export const POP_BONDING_FACTORY_BYTECODE = "0x" as `0x${string}`; // constructor: (tokenImpl, curveImpl, eventBus, lpLocker, treasury)
