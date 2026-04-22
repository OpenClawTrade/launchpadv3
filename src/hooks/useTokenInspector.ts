import { useQuery } from "@tanstack/react-query";
import { createPublicClient, formatEther, formatUnits, http, isAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import {
  ERC20_ABI,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  WETH,
  DEAD_ADDRESS,
} from "@/lib/ethereum/launchControl";

const client = createPublicClient({ chain: mainnet, transport: http() });

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
  // LP
  pairAddress: Address | null;
  hasPair: boolean;
  reserveToken: bigint | null;
  reserveEth: bigint | null;
  reserveEthFormatted: string | null;
  // LP token holdings of the connected wallet (if any)
  userLpBalance: bigint | null;
  // % of LP tokens that are burned
  lpBurnedPercent: number | null;
  lpTotalSupply: bigint | null;
  lpDeadBalance: bigint | null;
  // Verification
  isVerified: boolean | null; // null = unknown
}

async function checkVerified(address: string): Promise<boolean | null> {
  try {
    // Use Etherscan v2 public endpoint (no key needed for getsourcecode at low rate).
    // Falls back to null on failure so UI can degrade gracefully.
    const r = await fetch(
      `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address}`
    );
    const j = await r.json();
    const src = j?.result?.[0]?.SourceCode ?? "";
    return typeof src === "string" && src.length > 0;
  } catch {
    return null;
  }
}

async function fetchInspector(address: string, userAddress?: string): Promise<TokenInspectorData> {
  if (!isAddress(address)) throw new Error("Invalid address");
  const tokenAddr = address as Address;

  // Basic ERC20 reads (allow individual failures via try/catch).
  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch { return fallback; }
  };

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "name" }) as Promise<string>, "Unknown"),
    safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>, "???"),
    safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>, 18),
    safe(client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "totalSupply" }) as Promise<bigint>, 0n),
  ]);

  // Ownership probe
  let owner: Address | null = null;
  let hasOwnerFn = false;
  try {
    owner = (await client.readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "owner" })) as Address;
    hasOwnerFn = true;
  } catch {
    hasOwnerFn = false;
  }
  const isRenounced = owner === "0x0000000000000000000000000000000000000000";

  // setRule probe — try to estimate gas with dummy args; if function exists
  // viem returns a structured "execution reverted" rather than "function not found".
  // Cheap heuristic: simulateContract with read; if revert message != "function selector
  // was not recognized" → present.
  let hasSetRule = false;
  try {
    await client.simulateContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: "setRule",
      args: [false, DEAD_ADDRESS, 0n, 0n],
    });
    hasSetRule = true;
  } catch (e: any) {
    const msg = String(e?.shortMessage ?? e?.message ?? "");
    // If the function doesn't exist, viem says "function ... not found" / "returned no data"
    if (!/not found|returned no data|does not exist/i.test(msg)) {
      hasSetRule = true;
    }
  }

  // Uniswap V2 pair lookup
  const pairAddress = (await safe(
    client.readContract({
      address: UNISWAP_V2_FACTORY,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [tokenAddr, WETH],
    }) as Promise<Address>,
    "0x0000000000000000000000000000000000000000" as Address
  ));
  const hasPair = pairAddress !== "0x0000000000000000000000000000000000000000";

  let reserveToken: bigint | null = null;
  let reserveEth: bigint | null = null;
  let userLpBalance: bigint | null = null;
  let lpTotalSupply: bigint | null = null;
  let lpDeadBalance: bigint | null = null;
  let lpBurnedPercent: number | null = null;
  if (hasPair) {
    try {
      const [reserves, token0] = await Promise.all([
        client.readContract({ address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "getReserves" }) as Promise<readonly [bigint, bigint, number]>,
        client.readContract({ address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "token0" }) as Promise<Address>,
      ]);
      const [r0, r1] = reserves;
      const tokenIs0 = token0.toLowerCase() === tokenAddr.toLowerCase();
      reserveToken = tokenIs0 ? r0 : r1;
      reserveEth = tokenIs0 ? r1 : r0;
    } catch { /* ignore */ }

    try {
      lpTotalSupply = (await client.readContract({ address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "totalSupply" })) as bigint;
      lpDeadBalance = (await client.readContract({ address: pairAddress, abi: UNISWAP_V2_PAIR_ABI, functionName: "balanceOf", args: [DEAD_ADDRESS] })) as bigint;
      if (lpTotalSupply > 0n && lpDeadBalance != null) {
        lpBurnedPercent = Number((lpDeadBalance * 10_000n) / lpTotalSupply) / 100;
      }
    } catch { /* ignore */ }

    if (userAddress && isAddress(userAddress)) {
      try {
        userLpBalance = (await client.readContract({
          address: pairAddress,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: "balanceOf",
          args: [userAddress as Address],
        })) as bigint;
      } catch { /* ignore */ }
    }
  }

  const isVerified = await checkVerified(tokenAddr);

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
    pairAddress: hasPair ? pairAddress : null,
    hasPair,
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
