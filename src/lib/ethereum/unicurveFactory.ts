// Integration with the unicurve.fun bonding curve factory on Ethereum mainnet.
// All tokens launched here use the SAME factory contract as unicurve.fun, which means
// they appear on both platforms and follow identical curve mechanics 1:1.
import { parseAbi, type Address } from 'viem';

// Mainnet factory + implementations (extracted from on-chain bytecode of token 0x7ad4...c0de)
// Token + Curve are EIP-1167 minimal-proxy clones pointing at these implementations.
export const UNICURVE_FACTORY: Address = '0x195d262573556fc58e6f69e580271bfa84b1f5a1';
export const UNICURVE_TOKEN_IMPL: Address = '0xaaf62f61308540e774c2713437ad0f91874c2ee3';
export const UNICURVE_CURVE_IMPL: Address = '0x10049350072fb8e7b2b3b46ee07d7e6d7d6e209a';
// Auxiliary contract emitted in every trade — likely the protocol fee/router (also unverified).
export const UNICURVE_ROUTER_OR_FEEHOOK: Address = '0x7cae6f8c3c03a746f66f1a4d757519936f0bee6a';
// Uniswap V4 PoolManager — graduated tokens migrate here.
export const UNISWAP_V4_POOLMANAGER: Address = '0x000000000004444c5dc75cb358380d2e3de08a90';

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
