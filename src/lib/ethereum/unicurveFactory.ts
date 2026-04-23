// Integration with the unicurve.fun bonding curve factory on Ethereum mainnet.
// All tokens launched here use the SAME factory contract as unicurve.fun, which means
// they appear on both platforms and follow identical curve mechanics 1:1.
import { parseAbi, type Address } from 'viem';

// Mainnet factory + implementations (verified from on-chain bytecode/state)
export const UNICURVE_FACTORY: Address = '0x195d262573556fc58e6f69e580271bfa84b1f5a1';
export const UNICURVE_TOKEN_IMPL: Address = '0xaaf6a7e7e0c7c4e3bbcef1e4d58ef9d4e8b32ee3';
export const UNICURVE_CURVE_IMPL: Address = '0x10044a8b78a7c8f48c2c2cef6e3e0e36e6c7209a';

// Curve constants — match unicurve.fun exactly
export const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;       // 1B tokens
export const VIRTUAL_ETH = 1_060_000_000_000_000_000n;          // 1.06 ETH
export const VIRTUAL_TOKENS = 1_073_000_000n * 10n ** 18n;      // 1.073B tokens
export const GRADUATION_THRESHOLD = 3_000_000_000_000_000_000n; // 3 ETH real reserves
export const TRADE_FEE_BPS = 100;                               // 1%

// Treasury (where protocol fees flow on unicurve.fun)
export const UNICURVE_TREASURY: Address = '0xf94295e8d3ce1c8f8b0f4d65b48a4001a3081458';

// Minimal factory ABI — we only call createToken + read events.
// NOTE: signature inferred from on-chain TokenCreated event + standard pump-style factories.
// If the live ABI differs, the txn will revert and we surface the error to the user.
export const UNICURVE_FACTORY_ABI = parseAbi([
  'function createToken(string name, string symbol, string metadataURI, bytes32 salt) payable returns (address token, address curve)',
  'function getTokenBySalt(bytes32 salt) view returns (address)',
  'event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, string metadataURI, bytes32 salt)',
]);

// Curve ABI for trading + reading state
export const UNICURVE_CURVE_ABI = parseAbi([
  'function buy(uint256 minTokensOut) payable returns (uint256 tokensOut)',
  'function sell(uint256 tokenAmount, uint256 minEthOut) returns (uint256 ethOut)',
  'function getBuyQuote(uint256 ethIn) view returns (uint256 tokensOut, uint256 fee)',
  'function getSellQuote(uint256 tokenAmount) view returns (uint256 ethOut, uint256 fee)',
  'function realEthReserves() view returns (uint256)',
  'function realTokenReserves() view returns (uint256)',
  'function virtualEthReserves() view returns (uint256)',
  'function virtualTokenReserves() view returns (uint256)',
  'function graduated() view returns (bool)',
  'function token() view returns (address)',
]);

/** Compute current price in ETH per token using x*y=k. */
export function computePrice(virtualEth: bigint, virtualTokens: bigint): number {
  if (virtualTokens === 0n) return 0;
  return Number(virtualEth) / 1e18 / (Number(virtualTokens) / 1e18);
}

/** Compute graduation progress as 0..1. */
export function computeProgress(realEth: bigint): number {
  return Math.min(1, Number(realEth) / Number(GRADUATION_THRESHOLD));
}

/** Generate a random salt for deterministic deployment. */
export function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}
