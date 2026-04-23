// Unicurve.fun on-chain integration — fully reverse-engineered from mainnet bytecode
// + a real successful create tx (Pepecoin 0x7ad4…c0de).
// All selectors recovered via 4byte directory; all constants read live from-chain.
import { parseAbi, type Address } from 'viem';

// ── Core protocol contracts ──────────────────────────────────────────────────
export const UNICURVE_FACTORY: Address       = '0x195d262573556fc58e6f69e580271bfa84b1f5a1';
export const UNICURVE_TOKEN_IMPL: Address    = '0xaAf62f61308540e774c2713437ad0f91874C2ee3'; // MEME_IMPL
export const UNICURVE_CURVE_IMPL: Address    = '0x10049350072fB8E7B2b3B46EE07d7E6d7D6E209a';
export const UNICURVE_EVENT_BUS: Address     = '0x7CaE6f8c3c03A746F66f1a4d757519936F0bEe6a';
export const UNICURVE_TREASURY: Address      = '0xF942FC5C0ca2A9c33FC1F4dC3A399118B66d1458'; // also = owner
export const UNICURVE_HOOK: Address          = '0xafE727F2288E531184F5B9a81D3049b2f69A6880';
export const UNICURVE_LP_LOCKER: Address     = '0x1ac4afeb18ECceaCb884b3D9AD3AeB69A41B062c';

// Uniswap V4 infrastructure used at graduation
export const UNISWAP_V4_POOLMANAGER: Address      = '0x000000000004444c5dc75cB358380D2e3dE08A90';
export const UNISWAP_V4_POSITION_MANAGER: Address = '0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e';
export const PERMIT2: Address                     = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// ── Curve constants (verified live on-chain) ────────────────────────────────
export const TOTAL_SUPPLY        = 1_000_000_000n * 10n ** 18n;            // 1B
export const CURVE_TOKENS        = 792_857_143n * 10n ** 18n;              // ~792.86M sold via curve
export const VIRTUAL_ETH         = 1_060_000_000_000_000_000n;             // 1.06 ETH
export const VIRTUAL_TOKENS      = 1_073_000_000n * 10n ** 18n;            // 1.073B
export const GRADUATION_THRESHOLD = 3_000_000_000_000_000_000n;            // 3 ETH
export const TRADE_FEE_BPS       = 100;                                     // 1%
export const CREATOR_SHARE_BPS   = 5000;                                    // 50% of fee → creator
export const LP_CREATOR_SHARE_BPS = 5000;                                   // 50% of LP rewards → creator post-grad
export const LP_FEE_TIER         = 10000;                                   // 1% V4 pool fee
export const TICK_LOWER          = -887200;
export const TICK_UPPER          =  887200;
export const LAUNCH_FEE_WEI      = 10_000_000_000_000_000n;                 // 0.01 ETH minimum to createToken

// ── Factory ABI (real signatures) ────────────────────────────────────────────
// createToken selector 0x177021fc — confirmed by decoding tx 0xb920…2db
export const UNICURVE_FACTORY_ABI = parseAbi([
  'function createToken(string name, string symbol, string metadataURI, uint256 initialBuyEth, bytes32 salt) payable returns (address token, address curve)',
  'function predictAddresses(address creator, bytes32 salt) view returns (address token, address curve)',
  'function isUnicurveToken(address) view returns (bool)',
  'function MEME_IMPL() view returns (address)',
  'function CURVE_IMPL() view returns (address)',
  'function POOL_MANAGER() view returns (address)',
  'function POSITION_MANAGER() view returns (address)',
  'function HOOK() view returns (address)',
  'function PERMIT2() view returns (address)',
  'function LP_LOCKER() view returns (address)',
  'function EVENT_BUS() view returns (address)',
  'function PROTOCOL_TREASURY() view returns (address)',
  'function GRADUATION_THRESHOLD_WEI() view returns (uint256)',
  'function defaults() view returns (uint16 feeBps, uint16 creatorShareBps, uint24 lpFeeTier, uint16 lpCreatorShareBps)',
  'function owner() view returns (address)',
  'event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, bytes32 salt)',
]);

// ── Curve ABI (real signatures) ──────────────────────────────────────────────
// buy selector 0x7deb6025 = buy(uint256 minTokensOut, address recipient)
// sell selector 0xd79875eb = sell(uint256 tokenAmount, uint256 minEthOut)
export const UNICURVE_CURVE_ABI = parseAbi([
  'function buy(uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokenAmount, uint256 minEthOut) returns (uint256 ethOut)',
  'function quoteBuy(uint256 ethIn) view returns (uint256 tokensOut)',
  'function quoteSell(uint256 tokenAmount) view returns (uint256 ethOut)',
  'function realEthReserves() view returns (uint256)',
  'function realTokenReserves() view returns (uint256)',
  'function curveProgressBps() view returns (uint256)',
  'function getPrice() view returns (uint256)',
  'function token() view returns (address)',
  'function creator() view returns (address)',
  'function feeBps() view returns (uint16)',
  'function creatorShareBps() view returns (uint16)',
  'function graduationThreshold() view returns (uint256)',
  'function VIRTUAL_ETH() view returns (uint256)',
  'function VIRTUAL_TOKENS() view returns (uint256)',
  'function TOTAL_SUPPLY() view returns (uint256)',
  'function CURVE_TOKENS() view returns (uint256)',
  'function creatorFeesAccrued() view returns (uint256)',
  'function protocolFeesAccrued() view returns (uint256)',
  'function claimCreatorFees()',
]);

/** Current price in ETH per token (x*y=k). */
export function computePrice(virtualEth: bigint, virtualTokens: bigint): number {
  if (virtualTokens === 0n) return 0;
  return Number(virtualEth) / 1e18 / (Number(virtualTokens) / 1e18);
}

/** Graduation progress as 0..1 from real ETH reserves. */
export function computeProgress(realEth: bigint): number {
  return Math.min(1, Number(realEth) / Number(GRADUATION_THRESHOLD));
}

/** Random salt for deterministic deployment. */
export function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}
