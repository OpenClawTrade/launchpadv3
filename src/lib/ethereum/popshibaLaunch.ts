// Shared Ethereum launch helpers for the atomic PopShibaLauncher flow.
// Used by EthLauncher and any client wanting to call launcher.launch() directly.
import { decodeEventLog, parseAbi, type Address, type Hash, type PublicClient, type Log } from 'viem';

// V2/V3 launcher ABI — atomic launch + optional LP lock in one tx.
//   - V3 (current): launch(name, symbol, metadataURI, ethForLP, ethForDevBuy, lockLP) → Team Finance lock optional
//   - V2 (legacy):  launch(name, symbol, metadataURI, ethForLP, ethForDevBuy)         → UNCX always-lock
// Both emit Launched(token, creator, pool, lpTokenId[, locked]) so we can decode either.
export const POPSHIBA_LAUNCHER_ABI = parseAbi([
  // V3 entrypoint (current)
  'function launch(string name, string symbol, string metadataURI, uint256 ethForLP, uint256 ethForDevBuy, bool lockLP) payable returns (address token, address pool, uint256 lpTokenId, uint256 tfLockId)',
  'function teamFinanceFeeWei() view returns (uint256)',
  'function quoteTotalCost(uint256 ethForLP, uint256 ethForDevBuy, bool lockLP) view returns (uint256)',
  // V2 legacy view (kept so legacy launcher addresses still work for fee reads)
  'function uncxLockFeeWei() view returns (uint256)',
  // Events from any version — decoder picks whichever appears
  'event Launched(address indexed token, address indexed creator, address pool, uint256 lpTokenId, bool locked)',
  'event LpLocked(address indexed token, uint256 indexed tfLockId, uint256 unlockDate)',
  // Legacy V1/V2 events — still parsed for backward compatibility on old launcher addresses.
  'event TokenLaunched(address indexed token, address indexed creator, address pool, uint256 lpTokenId, uint256 ethForLP, uint256 ethForDevBuy)',
]);

// V2-only ABI for legacy launcher addresses (5-arg launch signature).
export const POPSHIBA_LAUNCHER_V2_ABI = parseAbi([
  'function launch(string name, string symbol, string metadataURI, uint256 ethForLP, uint256 ethForDevBuy) payable returns (address token, address pool, uint256 lpTokenId, uint256 uncxLockId)',
  'function uncxLockFeeWei() view returns (uint256)',
  'event Launched(address indexed token, address indexed creator, address pool, uint256 lpTokenId)',
  'event LpLocked(address indexed token, uint256 indexed uncxLockId, uint256 unlockDate)',
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
  /** Locker id (UNCX or Team Finance, depending on launcher version). Present only if LP was locked. */
  uncxLockId?: bigint;
  /** True if LP was locked at launch (V2: always true; V3: depends on lockLP flag). */
  locked?: boolean;
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
  let locked: boolean | undefined;

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
        const args = decoded.args as unknown as { token: Address; pool: Address; lpTokenId: bigint; locked?: boolean };
        token = args.token;
        pool = args.pool;
        lpTokenId = args.lpTokenId;
        if (typeof args.locked === 'boolean') locked = args.locked;
      } else if (decoded.eventName === 'LpLocked') {
        const args = decoded.args as unknown as { uncxLockId?: bigint; tfLockId?: bigint };
        uncxLockId = args.uncxLockId ?? args.tfLockId;
      }
    } catch {
      // not our event — ignore
    }
  }

  if (!token || !pool || lpTokenId === null) {
    throw new Error('Launched event not found in receipt');
  }
  return { token, pool, lpTokenId, uncxLockId, locked, txHash };
}
