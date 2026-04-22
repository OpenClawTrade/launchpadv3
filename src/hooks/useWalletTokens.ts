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

function formatBalance(raw: bigint, dec: number): string {
  const div = 10n ** BigInt(dec);
  const whole = raw / div;
  const frac = raw % div;
  const fracStr = (Number(frac) / Number(div)).toFixed(4).slice(2);
  return `${whole.toString()}.${fracStr}`;
}

async function fetchFromBlockscout(address: string): Promise<HeldToken[]> {
  const url = `https://eth.blockscout.com/api/v2/addresses/${address}/token-balances`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Blockscout ${r.status}`);
    const j = (await r.json()) as BlockscoutTokenItem[];
    const out: HeldToken[] = [];
    for (const item of j ?? []) {
      if (!item?.token || item.token.type !== "ERC-20") continue;
      const dec = Number(item.token.decimals ?? "18") || 18;
      const raw = BigInt(item.value || "0");
      if (raw === 0n) continue;
      out.push({
        address: item.token.address,
        name: item.token.name || "Unknown",
        symbol: item.token.symbol || "???",
        decimals: dec,
        balance: formatBalance(raw, dec),
      });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

interface EthplorerTokenInfo {
  tokenInfo: {
    address: string;
    name?: string;
    symbol?: string;
    decimals?: string | number;
  };
  balance: number | string;
  rawBalance?: string;
}

async function fetchFromEthplorer(address: string): Promise<HeldToken[]> {
  // Free tier key "freekey" — no signup, modest rate limits.
  const url = `https://api.ethplorer.io/getAddressInfo/${address}?apiKey=freekey`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`Ethplorer ${r.status}`);
    const j: { tokens?: EthplorerTokenInfo[] } = await r.json();
    const out: HeldToken[] = [];
    for (const t of j.tokens ?? []) {
      const dec = Number(t.tokenInfo?.decimals ?? 18) || 18;
      const rawStr = t.rawBalance ?? String(t.balance ?? "0");
      let raw: bigint;
      try {
        raw = BigInt(rawStr.split(".")[0] || "0");
      } catch {
        continue;
      }
      if (raw === 0n) continue;
      out.push({
        address: t.tokenInfo.address,
        name: t.tokenInfo.name || "Unknown",
        symbol: t.tokenInfo.symbol || "???",
        decimals: dec,
        balance: formatBalance(raw, dec),
      });
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHeldTokens(address: string): Promise<HeldToken[]> {
  const errors: string[] = [];
  // Try Blockscout first (richest data, no key)
  try {
    const r = await fetchFromBlockscout(address);
    if (r.length > 0) return r;
    // empty result might be legit OR an indexer miss — try fallback before giving up
    errors.push("blockscout: 0 tokens");
  } catch (e: any) {
    errors.push(`blockscout: ${e?.message || e}`);
  }
  // Fallback: Ethplorer
  try {
    return await fetchFromEthplorer(address);
  } catch (e: any) {
    errors.push(`ethplorer: ${e?.message || e}`);
  }
  console.warn("[useWalletTokens] all providers failed:", errors);
  return [];
}

export function useWalletTokens(address?: string) {
  const enabled = !!address && isAddress(address);
  return useQuery({
    queryKey: ["wallet-tokens", address?.toLowerCase()],
    queryFn: () => fetchHeldTokens(address as string),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
