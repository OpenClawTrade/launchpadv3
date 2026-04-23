// PopShiba V4 — singleton-architecture, 1:1 fork of unicurve.fun.
//
// Architecture (matches Unicurve's mainnet deployment):
//   - ONE singleton hook deployed at a CREATE2-mined address with the required
//     permission bits (lower 14 bits == 0x2A88).
//   - Per-launch: factory deploys an EIP-1167 clone of `PopCurveImpl` (the
//     "CURVE_IMPL") that holds all reserves, fee accruals, and PoolKey state.
//     The hook is stateless w.r.t. tokens; it routes via `curveOf[poolId]`.
//   - Token clone is transfer-locked until graduation (`enableTransfers()`).
//   - Post-grad LP is a V4 PositionManager NFT held forever by `PopV4LpLocker`.
//
// Addresses populated AFTER the one-time `popv4-deploy-factory` deploy runs.
// They live in the `bonding_deployments` table (network='mainnet-v4') and the
// `POP_V4_*` edge-function secrets.
import { parseAbi, type Address } from "viem";

// Uniswap V4 mainnet singletons.
export const POP_V4_POOL_MANAGER: Address      = "0x000000000004444c5dc75cB358380D2e3dE08A90";
export const POP_V4_POSITION_MANAGER: Address  = "0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e";
export const POP_V4_UNIVERSAL_ROUTER: Address  = "0x66a9893cc07d91d95644aedd05d03f95e1dba8af";
export const POP_V4_QUOTER: Address            = "0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203";
export const PERMIT2: Address                  = "0x000000000022d473030f116ddee9f6b43ac78ba3";

// PoolKey constants used at every launch — must match contract constants.
export const POP_V4_LP_FEE       = 10_000; // 1%
export const POP_V4_TICK_SPACING = 60;

// Curve constants (must match PopCurveImpl.sol exactly).
export const POP_V4_TOTAL_SUPPLY        = 1_000_000_000n * 10n ** 18n;
export const POP_V4_CURVE_TOKENS        = 792_857_143n * 10n ** 18n;
export const POP_V4_LP_TOKENS           = POP_V4_TOTAL_SUPPLY - POP_V4_CURVE_TOKENS;
export const POP_V4_VIRTUAL_ETH         = 1_060_000_000_000_000_000n;
export const POP_V4_VIRTUAL_TOKENS      = 1_073_000_000n * 10n ** 18n;
export const POP_V4_GRADUATION_THRESHOLD = 3_000_000_000_000_000_000n; // 3 ETH
export const POP_V4_FEE_BPS             = 100;
export const POP_V4_CREATOR_SHARE_BPS   = 5_000;
export const POP_V4_PROTOCOL_SHARE_BPS  = 5_000;

// Singleton hook ABI — pool-agnostic. Per-token state via curveOf[poolId].
export const POP_V4_HOOK_ABI = parseAbi([
  "function curveOf(bytes32 poolId) view returns (address)",
  "function FACTORY() view returns (address)",
  "event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 fee, uint256 creatorFee, uint256 protocolFee, uint256 newRealEth, uint256 newRealTokens, uint256 priceAfter, uint256 progressBps, uint256 timestamp)",
  "event Graduated(address indexed token, uint256 ethToLp, uint256 tokensToLp)",
  "event CurveRegistered(bytes32 indexed poolId, address indexed token, address indexed curve)",
]);

// Per-token curve clone ABI — read views + fee claims live here.
export const POP_V4_CURVE_ABI = parseAbi([
  "function token() view returns (address)",
  "function creator() view returns (address)",
  "function protocolTreasury() view returns (address)",
  "function lpLocker() view returns (address)",
  "function graduated() view returns (bool)",
  "function realEthReserves() view returns (uint256)",
  "function realTokenReserves() view returns (uint256)",
  "function creatorFeesAccrued() view returns (uint256)",
  "function protocolFeesAccrued() view returns (uint256)",
  "function quoteBuy(uint256 ethIn) view returns (uint256)",
  "function quoteSell(uint256 tokenIn) view returns (uint256)",
  "function getPrice() view returns (uint256)",
  "function curveProgressBps() view returns (uint256)",
  "function poolKeyTuple() view returns (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hook)",
]);

// Token ABI — adds enableTransfers() + transfersEnabled view.
export const POP_V4_TOKEN_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfersEnabled() view returns (bool)",
  "function curve() view returns (address)",
  "event TransfersEnabled()",
]);

// LP Locker ABI — claim trading fees from the locked V4 PositionManager NFT.
export const POP_V4_LP_LOCKER_ABI = parseAbi([
  "function lockedPosition(bytes32 poolId) view returns (uint256 tokenId)",
  "function curveOf(bytes32 poolId) view returns (address)",
  "function claimFees(bytes32 poolId)",
  "event Locked(bytes32 indexed poolId, uint256 indexed tokenId, address indexed curve)",
  "event FeesClaimed(bytes32 indexed poolId, uint256 eth, uint256 tokens)",
]);

// Factory ABI
export const POP_V4_FACTORY_ABI = parseAbi([
  "function launch(string name, string symbol, uint160 sqrtPriceX96) returns (address token, address curve, bytes32 poolId)",
  "function poolManager() view returns (address)",
  "function hook() view returns (address)",
  "function curveImpl() view returns (address)",
  "function tokenImpl() view returns (address)",
  "function lpLocker() view returns (address)",
  "function treasury() view returns (address)",
  "event Launched(address indexed token, address indexed curve, address indexed creator, bytes32 poolId)",
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
