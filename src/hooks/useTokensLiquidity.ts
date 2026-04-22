import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, http, type Address } from "viem";
import { mainnet } from "viem/chains";
import {
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  WETH,
} from "@/lib/ethereum/launchControl";

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

const ZERO = "0x0000000000000000000000000000000000000000";

/** Returns map of tokenAddress(lowercase) -> hasLiquidity (V2/WETH pair with reserves > 0). */
async function probeLiquidity(addresses: Address[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  if (addresses.length === 0) return result;

  // Step 1: factory.getPair for each token paired with WETH
  const pairResults = await Promise.all(
    addresses.map((addr) =>
      client
        .readContract({
          address: UNISWAP_V2_FACTORY,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: "getPair",
          args: [addr, WETH],
        })
        .then((pair: Address) => ({ token: addr, pair }))
        .catch(() => ({ token: addr, pair: ZERO as Address }))
    )
  );

  // Step 2: for tokens with a pair, read reserves; otherwise mark false
  await Promise.all(
    pairResults.map(async ({ token, pair }) => {
      const key = token.toLowerCase();
      if (!pair || pair === ZERO) {
        result[key] = false;
        return;
      }
      try {
        const reserves: any = await client.readContract({
          address: pair,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: "getReserves",
        });
        const r0 = BigInt(reserves[0] ?? 0);
        const r1 = BigInt(reserves[1] ?? 0);
        result[key] = r0 > 0n && r1 > 0n;
      } catch {
        result[key] = false;
      }
    })
  );

  return result;
}

export function useTokensLiquidity(addresses: string[] | undefined) {
  const list = (addresses ?? []).filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a));
  const key = list.map((a) => a.toLowerCase()).sort().join(",");
  return useQuery({
    queryKey: ["tokens-liquidity", key],
    queryFn: () => probeLiquidity(list as Address[]),
    enabled: list.length > 0,
    staleTime: 60_000,
    retry: 1,
  });
}
