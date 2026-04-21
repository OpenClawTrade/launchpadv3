// Shared Ethereum launch helpers for the atomic PopShibaLauncher flow.
// Used by EthLauncher and any client wanting to call launcher.launch() directly.
import { decodeEventLog, parseAbi, type Address, type Hash, type PublicClient } from 'viem';

export const POPSHIBA_LAUNCHER_ABI = parseAbi([
  'function launch(string name, string symbol, string metadataURI, uint160 sqrtPriceX96, uint256 ethForDevBuy) payable returns (address token, address pool, uint256 lpTokenId)',
  'event TokenLaunched(address indexed token, address indexed creator, address pool, uint256 lpTokenId, uint256 ethForLP, uint256 ethForDevBuy)',
]);

export const WETH_MAINNET: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const TOTAL_SUPPLY_WEI = 1_000_000_000n * 10n ** 18n;
export const FEE_TIER = 10000; // 1%

/**
 * sqrtPriceX96 = sqrt(token1 / token0) * 2^96
 * Token order on V3 is by ascending address. We compute the WETH-per-token
 * ratio (or its inverse if WETH is token0) and convert to Q64.96.
 */
export function computeSqrtPriceX96(tokenAddress: string, priceWethPerToken: number): bigint {
  const tokenIsToken0 = tokenAddress.toLowerCase() < WETH_MAINNET.toLowerCase();
  const ratio = tokenIsToken0 ? priceWethPerToken : 1 / priceWethPerToken;
  const sqrt = Math.sqrt(ratio);
  const Q96 = 2 ** 96;
  const product = sqrt * Q96;
  if (!isFinite(product) || product <= 0) throw new Error('Bad sqrtPriceX96');
  return BigInt(Math.floor(product));
}

/** Build the JSON metadata blob stored on-chain. */
export function buildMetadataURI(opts: {
  name: string;
  symbol: string;
  description?: string | null;
  image?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  launchId?: string | null;
}): string {
  return JSON.stringify({
    name: opts.name,
    symbol: opts.symbol,
    description: (opts.description || '').slice(0, 500),
    image: opts.image || '',
    website: opts.website || '',
    twitter: opts.twitter || '',
    telegram: opts.telegram || '',
    launchpad: 'popshiba-eth-v2-atomic',
    launchId: opts.launchId || '',
  });
}

export interface LaunchResult {
  token: Address;
  pool: Address;
  lpTokenId: bigint;
  txHash: Hash;
}

/** Parse the TokenLaunched event from a launch tx receipt. */
export async function waitForLaunchResult(
  publicClient: PublicClient,
  launcherAddress: Address,
  txHash: Hash,
): Promise<LaunchResult> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error('Launch transaction reverted');

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== launcherAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: POPSHIBA_LAUNCHER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'TokenLaunched') {
        const args = decoded.args as {
          token: Address;
          pool: Address;
          lpTokenId: bigint;
        };
        return {
          token: args.token,
          pool: args.pool,
          lpTokenId: args.lpTokenId,
          txHash,
        };
      }
    } catch {
      // not our event — ignore
    }
  }
  throw new Error('TokenLaunched event not found in receipt');
}
