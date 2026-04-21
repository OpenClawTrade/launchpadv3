// Shared Ethereum launch helpers for the atomic PopShibaLauncher flow.
// Used by EthLauncher and any client wanting to call launcher.launch() directly.
import { decodeEventLog, parseAbi, type Address, type Hash, type PublicClient, type Log } from 'viem';

// V2 launcher ABI — atomic launch + UNCX V3 lock in one tx.
// Launched(token, creator, pool, lpTokenId) is the canonical "token is live" event.
// LpLocked(token, uncxLockId, unlockDate) is the new UNCX lock receipt.
export const POPSHIBA_LAUNCHER_ABI = parseAbi([
  'function launch(string name, string symbol, string metadataURI, uint256 ethForLP, uint256 ethForDevBuy) payable returns (address token, address pool, uint256 lpTokenId, uint256 uncxLockId)',
  'function uncxLockFeeWei() view returns (uint256)',
  'event Launched(address indexed token, address indexed creator, address pool, uint256 lpTokenId)',
  'event LpLocked(address indexed token, uint256 indexed uncxLockId, uint256 unlockDate)',
  // Legacy v1 event — still parsed for backward compatibility on old launcher addresses.
  'event TokenLaunched(address indexed token, address indexed creator, address pool, uint256 lpTokenId, uint256 ethForLP, uint256 ethForDevBuy)',
]);

export const WETH_MAINNET: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const TOTAL_SUPPLY_WEI = 1_000_000_000n * 10n ** 18n;
export const FEE_TIER = 10000; // 1%

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
  /** UNCX V3 locker id. Present when launched via PopShibaLauncherV2. */
  uncxLockId?: bigint;
  txHash: Hash;
}

/** Parse Launched / TokenLaunched + LpLocked events from a launch tx receipt. */
export async function waitForLaunchResult(
  publicClient: PublicClient,
  launcherAddress: Address,
  txHash: Hash,
): Promise<LaunchResult> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error('Launch transaction reverted');

  let token: Address | null = null;
  let pool: Address | null = null;
  let lpTokenId: bigint | null = null;
  let uncxLockId: bigint | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== launcherAddress.toLowerCase()) continue;
    const anyLog = log as unknown as { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] };
    try {
      const decoded = decodeEventLog({
        abi: POPSHIBA_LAUNCHER_ABI,
        data: anyLog.data,
        topics: anyLog.topics,
      }) as { eventName: string; args: Record<string, unknown> };

      if (decoded.eventName === 'Launched' || decoded.eventName === 'TokenLaunched') {
        const args = decoded.args as unknown as { token: Address; pool: Address; lpTokenId: bigint };
        token = args.token;
        pool = args.pool;
        lpTokenId = args.lpTokenId;
      } else if (decoded.eventName === 'LpLocked') {
        const args = decoded.args as unknown as { uncxLockId: bigint };
        uncxLockId = args.uncxLockId;
      }
    } catch {
      // not our event — ignore
    }
  }

  if (!token || !pool || lpTokenId === null) {
    throw new Error('Launched event not found in receipt');
  }
  return { token, pool, lpTokenId, uncxLockId, txHash };
}
