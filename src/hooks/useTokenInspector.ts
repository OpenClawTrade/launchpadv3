import { useQuery } from "@tanstack/react-query";
import {
  createPublicClient,
  encodeFunctionData,
  fallback,
  formatEther,
  formatUnits,
  http,
  isAddress,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import {
  ERC20_ABI,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  WETH,
  DEAD_ADDRESS,
} from "@/lib/ethereum/launchControl";

// Reliable RPC fallback chain — public nodes that don't require API keys.
const client: any = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [
      http("https://ethereum-rpc.publicnode.com"),
      http("https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://cloudflare-eth.com"),
    ],
    { rank: false, retryCount: 1 }
  ),
});

// Uniswap V3 factory + common stable pairs to also probe.
const UNISWAP_V3_FACTORY: Address = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDT: Address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const V3_FEE_TIERS = [100, 500, 3000, 10000] as const;

const UNISWAP_V3_FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { type: "address" },
      { type: "address" },
      { type: "uint24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

export interface PoolInfo {
  dex: "uniswap-v2" | "uniswap-v3";
  pairAddress: Address;
  pairedWith: "WETH" | "USDC" | "USDT";
  feeTier?: number; // V3 only
  reserveToken?: bigint;
  reserveQuote?: bigint;
  reserveQuoteFormatted?: string;
}

export interface TokenInspectorData {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  totalSupplyFormatted: string;
  // Ownership
  owner: Address | null;
  isRenounced: boolean;
  hasOwnerFn: boolean;
  // Anti-bot / setRule
  hasSetRule: boolean;
  // Live setRule state (null when contract doesn't expose the getter)
  ruleLimited: boolean | null;
  ruleConfiguredPair: Address | null;
  ruleMaxHoldingAmount: bigint | null;
  ruleMaxHoldingFormatted: string | null;
  ruleMaxHoldingPercent: number | null;
  // Primary pool (first one found, V2 WETH preferred)
  primaryPool: PoolInfo | null;
  allPools: PoolInfo[];
  // Convenience accessors for the primary pool
  pairAddress: Address | null;
  hasPair: boolean;
  reserveToken: bigint | null;
  reserveEth: bigint | null;
  reserveEthFormatted: string | null;
  // LP token holdings of the connected wallet (V2 only)
  userLpBalance: bigint | null;
  lpBurnedPercent: number | null;
  lpTotalSupply: bigint | null;
  lpDeadBalance: bigint | null;
  // Verification (Blockscout — no API key needed)
  isVerified: boolean | null;
}

/**
 * Etherscan v2 needs a key. Blockscout's public mainnet instance does not, and
 * its `is_verified` flag is reliable for our purposes.
 */
async function checkVerified(address: string): Promise<boolean | null> {
  try {
    const r = await fetch(
      `https://eth.blockscout.com/api/v2/addresses/${address}`,
      { headers: { accept: "application/json" } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (typeof j?.is_verified === "boolean") return j.is_verified;
    return null;
  } catch {
    return null;
  }
}

/** Try to find any liquidity pool: V2 (WETH/USDC/USDT) and V3 across all fee tiers. */
async function findPools(tokenAddr: Address): Promise<PoolInfo[]> {
  const pools: PoolInfo[] = [];
  const ZERO = "0x0000000000000000000000000000000000000000";

  const quoteTokens: Array<{ addr: Address; label: PoolInfo["pairedWith"] }> = [
    { addr: WETH, label: "WETH" },
    { addr: USDC, label: "USDC" },
    { addr: USDT, label: "USDT" },
  ];

  // V2 lookups in parallel
  const v2Calls = quoteTokens.map((q) =>
    client
      .readContract({
        address: UNISWAP_V2_FACTORY,
        abi: UNISWAP_V2_FACTORY_ABI,
        functionName: "getPair",
        args: [tokenAddr, q.addr],
      })
      .then((addr: Address) => ({ q, addr }))
      .catch(() => ({ q, addr: ZERO as Address }))
  );

  // V3 lookups in parallel (all tiers × all quote tokens)
  const v3Calls = quoteTokens.flatMap((q) =>
    V3_FEE_TIERS.map((fee) =>
      client
        .readContract({
          address: UNISWAP_V3_FACTORY,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "getPool",
          args: [tokenAddr, q.addr, fee],
        })
        .then((addr: Address) => ({ q, fee, addr }))
        .catch(() => ({ q, fee, addr: ZERO as Address }))
    )
  );

  const [v2Results, v3Results] = await Promise.all([
    Promise.all(v2Calls),
    Promise.all(v3Calls),
  ]);

  for (const { q, addr } of v2Results) {
    if (addr && addr !== ZERO) {
      pools.push({ dex: "uniswap-v2", pairAddress: addr, pairedWith: q.label });
    }
  }
  for (const { q, fee, addr } of v3Results) {
    if (addr && addr !== ZERO) {
      pools.push({ dex: "uniswap-v3", pairAddress: addr, pairedWith: q.label, feeTier: fee });
    }
  }

  return pools;
}

async function fetchInspector(
  address: string,
  userAddress?: string
): Promise<TokenInspectorData> {
  if (!isAddress(address)) throw new Error("Invalid address");
  const tokenAddr = address as Address;

  const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => {
    try { return await p; } catch { return fb; }
  };

  // Fire all root-level reads in parallel.
  const [name, symbol, decimals, totalSupply, ownerProbe, setRuleProbe, pools, isVerified] =
    await Promise.all([
      safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "name" }) as Promise<string>, "Unknown"),
      safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>, "???"),
      safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>, 18),
      safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "totalSupply" }) as Promise<bigint>, 0n),
      client
        .readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "owner" })
        .then((o: Address) => ({ owner: o as Address | null, has: true }))
        .catch(() => ({ owner: null, has: false })),
      // setRule presence: encode the call data and use eth_call directly. If the
      // function selector isn't present, we get a "no data" / specific revert.
      client
        .call({
          to: tokenAddr,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "setRule",
            args: [false, DEAD_ADDRESS, 0n, 0n],
          }),
        })
        .then(() => true)
        .catch((e: any) => {
          const msg = String(e?.shortMessage ?? e?.message ?? "");
          // Function not implemented → typically empty return data or specific revert.
          if (/returned no data|function .* not found|0x$/i.test(msg)) return false;
          return true;
        }),
      findPools(tokenAddr),
      checkVerified(tokenAddr),
    ]);

  const owner = ownerProbe.owner;
  const hasOwnerFn = ownerProbe.has;
  const isRenounced = owner === "0x0000000000000000000000000000000000000000";
  const hasSetRule = setRuleProbe;

  // Pick primary pool: prefer V2 WETH, then V3 WETH, then anything else.
  const sorted = [...pools].sort((a, b) => {
    const score = (p: PoolInfo) =>
      (p.dex === "uniswap-v2" ? 0 : 10) + (p.pairedWith === "WETH" ? 0 : 5);
    return score(a) - score(b);
  });
  const primary = sorted[0] ?? null;

  // Enrich primary pool with reserves.
  let reserveToken: bigint | null = null;
  let reserveEth: bigint | null = null;
  let userLpBalance: bigint | null = null;
  let lpTotalSupply: bigint | null = null;
  let lpDeadBalance: bigint | null = null;
  let lpBurnedPercent: number | null = null;

  if (primary?.dex === "uniswap-v2") {
    try {
      const [reserves, token0] = await Promise.all([
        client.readContract({ address: primary.pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "getReserves" }) as Promise<readonly [bigint, bigint, number]>,
        client.readContract({ address: primary.pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "token0" }) as Promise<Address>,
      ]);
      const [r0, r1] = reserves;
      const tokenIs0 = token0.toLowerCase() === tokenAddr.toLowerCase();
      reserveToken = tokenIs0 ? r0 : r1;
      reserveEth = tokenIs0 ? r1 : r0;
      primary.reserveToken = reserveToken;
      primary.reserveQuote = reserveEth;
      primary.reserveQuoteFormatted = parseFloat(formatEther(reserveEth)).toFixed(4);
    } catch { /* ignore */ }

    try {
      lpTotalSupply = (await client.readContract({ address: primary.pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "totalSupply" })) as bigint;
      lpDeadBalance = (await client.readContract({ address: primary.pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "balanceOf", args: [DEAD_ADDRESS] })) as bigint;
      if (lpTotalSupply > 0n) {
        lpBurnedPercent = Number((lpDeadBalance * 10_000n) / lpTotalSupply) / 100;
      }
    } catch { /* ignore */ }

    if (userAddress && isAddress(userAddress)) {
      try {
        userLpBalance = (await client.readContract({
          address: primary.pairAddress,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: "balanceOf",
          args: [userAddress as Address],
        })) as bigint;
      } catch { /* ignore */ }
    }
  }

  return {
    address: tokenAddr,
    name,
    symbol,
    decimals,
    totalSupply,
    totalSupplyFormatted: Number(formatUnits(totalSupply, decimals)).toLocaleString(),
    owner,
    isRenounced,
    hasOwnerFn,
    hasSetRule,
    primaryPool: primary,
    allPools: pools,
    pairAddress: primary?.pairAddress ?? null,
    hasPair: !!primary,
    reserveToken,
    reserveEth,
    reserveEthFormatted: reserveEth != null ? parseFloat(formatEther(reserveEth)).toFixed(4) : null,
    userLpBalance,
    lpTotalSupply,
    lpDeadBalance,
    lpBurnedPercent,
    isVerified,
  };
}

export function useTokenInspector(address: string | null, userAddress?: string) {
  const enabled = !!address && isAddress(address);
  return useQuery({
    queryKey: ["token-inspector", address?.toLowerCase(), userAddress?.toLowerCase()],
    queryFn: () => fetchInspector(address as string, userAddress),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
