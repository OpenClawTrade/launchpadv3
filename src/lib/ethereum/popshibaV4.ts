// PopShiba V4 — our 1:1 fork of unicurve.fun's V4 architecture.
// Addresses are populated AFTER the one-time `popv4-deploy-factory` deploy runs.
// They live in the `bonding_deployments` table (network='mainnet-v4') and the
// `POP_V4_FACTORY_ADDRESS` edge-function secret.
//
// The hook + token addresses for an individual launch are stored per-token in
// the `bonding_tokens` table (curve_address column = hook address for V4).
import { parseAbi, type Address } from "viem";

// Uniswap V4 mainnet singletons (shared with Unicurve, Universal Router, etc).
export const POP_V4_POOL_MANAGER: Address      = "0x000000000004444c5dc75cB358380D2e3dE08A90";
export const POP_V4_POSITION_MANAGER: Address  = "0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e";
export const POP_V4_UNIVERSAL_ROUTER: Address  = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
export const POP_V4_QUOTER: Address            = "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203";
export const PERMIT2: Address                  = "0x000000000022d473030f116ddee9f6b43ac78ba3";

// PoolKey constants used at every launch — must match contract constants.
export const POP_V4_LP_FEE      = 10_000; // 1%
export const POP_V4_TICK_SPACING = 60;

// Curve constants (must match PopBondingHookV4.sol exactly).
export const POP_V4_TOTAL_SUPPLY        = 1_000_000_000n * 10n ** 18n;
export const POP_V4_CURVE_TOKENS        = 792_857_143n * 10n ** 18n;
export const POP_V4_LP_TOKENS           = POP_V4_TOTAL_SUPPLY - POP_V4_CURVE_TOKENS;
export const POP_V4_VIRTUAL_ETH         = 1_060_000_000_000_000_000n;
export const POP_V4_VIRTUAL_TOKENS      = 1_073_000_000n * 10n ** 18n;
export const POP_V4_GRADUATION_THRESHOLD = 3_000_000_000_000_000_000n; // 3 ETH
export const POP_V4_FEE_BPS             = 100;
export const POP_V4_CREATOR_SHARE_BPS   = 5_000;
export const POP_V4_PROTOCOL_SHARE_BPS  = 5_000;

// Hook (per-token) ABI — same surface as unicurve's curve clone but with
// V4-native methods.
export const POP_V4_HOOK_ABI = parseAbi([
  "function token() view returns (address)",
  "function creator() view returns (address)",
  "function protocolTreasury() view returns (address)",
  "function graduated() view returns (bool)",
  "function realEthReserves() view returns (uint256)",
  "function realTokenReserves() view returns (uint256)",
  "function creatorFeesAccrued() view returns (uint256)",
  "function protocolFeesAccrued() view returns (uint256)",
  "function poolKey() view returns (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)",
  "function poolId() view returns (bytes32)",
  "function claimCreatorFees()",
  "function sweepProtocolFees()",
  "function seedLockedLP()",
  "event Buy(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens)",
  "event Sell(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 fee, uint256 newRealEth, uint256 newRealTokens)",
  "event Graduated(uint256 ethToLp, uint256 tokensToLp)",
]);

// Factory ABI
export const POP_V4_FACTORY_ABI = parseAbi([
  "function launch(string name, string symbol, bytes32 salt, uint160 sqrtPriceX96) returns (address token, address hook)",
  "function poolManager() view returns (address)",
  "function tokenImpl() view returns (address)",
  "function treasury() view returns (address)",
  "event Launched(address indexed token, address indexed hook, address indexed creator, bytes32 salt)",
]);

// Spot price on the curve (ETH per token, 18-decimal scaled), pre-graduation.
export function popV4SpotEthPerToken(realEth: bigint, realTokens: bigint): bigint {
  const ve = POP_V4_VIRTUAL_ETH + realEth;
  const vt = POP_V4_VIRTUAL_TOKENS - (POP_V4_CURVE_TOKENS - realTokens);
  if (vt === 0n) return 0n;
  return (ve * 10n ** 18n) / vt;
}

// Bonding progress in basis points (0..10_000).
export function popV4ProgressBps(realEth: bigint): number {
  if (realEth <= 0n) return 0;
  if (realEth >= POP_V4_GRADUATION_THRESHOLD) return 10_000;
  return Number((realEth * 10_000n) / POP_V4_GRADUATION_THRESHOLD);
}
