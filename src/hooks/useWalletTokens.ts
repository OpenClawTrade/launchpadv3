import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";

export interface HeldToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string; // formatted
  /** True when the connected wallet is the contract `owner()` (deployer). */
  isOwner?: boolean;
}

interface BlockscoutTokenItem {
  token: {
    address: string;
    name: string | null;
    symbol: string | null;
    decimals: string | null;
    type: string;
  };
  value: string; // raw bigint string
}

async function fetchHeldTokens(address: string): Promise<HeldToken[]> {
  // Blockscout public mainnet — no API key required.
  const url = `https://eth.blockscout.com/api/v2/addresses/${address}/token-balances`;
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`Blockscout ${r.status}`);
  const j = (await r.json()) as BlockscoutTokenItem[];

  const out: HeldToken[] = [];
  for (const item of j ?? []) {
    if (!item?.token || item.token.type !== "ERC-20") continue;
    const dec = Number(item.token.decimals ?? "18") || 18;
    const raw = BigInt(item.value || "0");
    if (raw === 0n) continue;
    // human-readable balance, capped to 4 decimals
    const div = 10n ** BigInt(dec);
    const whole = raw / div;
    const frac = raw % div;
    const fracStr = (Number(frac) / Number(div)).toFixed(4).slice(2);
    out.push({
      address: item.token.address,
      name: item.token.name || "Unknown",
      symbol: item.token.symbol || "???",
      decimals: dec,
      balance: `${whole.toString()}.${fracStr}`,
    });
  }
  // Largest first (rough heuristic by integer part length)
  out.sort((a, b) => b.balance.length - a.balance.length);
  return out;
}

export function useWalletTokens(address?: string) {
  const enabled = !!address && isAddress(address);
  return useQuery({
    queryKey: ["wallet-tokens", address?.toLowerCase()],
    queryFn: () => fetchHeldTokens(address as string),
    enabled,
    staleTime: 30_000,
  });
}
