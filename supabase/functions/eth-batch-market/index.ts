// eth-batch-market
// Batch-fetch on-chain market data (price, market cap, 24h volume, 24h change,
// liquidity) for ETH-mainnet token addresses via DexScreener.
//
// Holder counts come from Codex (network 1 = Ethereum mainnet) since
// DexScreener does not expose holder counts.
//
// Input:  { addresses: string[] }   // ETH addresses, max 30 per call
// Output: { results: Record<lowercaseAddress, {
//            priceUsd, marketCap, volumeH24, changeH24, liquidityUsd, pairUrl, holders
//          }> }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const ETH_NETWORK_ID = 1;

async function fetchCodexHolders(addresses: string[]): Promise<Record<string, number>> {
  const apiKey = Deno.env.get("CODEX_API_KEY");
  if (!apiKey || addresses.length === 0) return {};

  const aliases = addresses.map((addr, i) => {
    return `t${i}: filterTokens(
      filters: { network: [${ETH_NETWORK_ID}] }
      tokens: ["${addr}"]
      limit: 1
    ) {
      results { holders token { address } }
    }`;
  });
  const query = `{ ${aliases.join("\n")} }`;

  try {
    const res = await fetch("https://graph.codex.io/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      console.warn("[eth-batch-market] codex holders error", res.status);
      return {};
    }
    const data = await res.json();
    const out: Record<string, number> = {};
    for (let i = 0; i < addresses.length; i++) {
      const results = data?.data?.[`t${i}`]?.results;
      if (!results || results.length === 0) continue;
      const r = results[0];
      const addr = (r?.token?.address ?? addresses[i]).toLowerCase();
      if (typeof r?.holders === "number") out[addr] = r.holders;
      else if (r?.holders != null) out[addr] = parseInt(String(r.holders), 10) || 0;
    }
    return out;
  } catch (e) {
    console.warn("[eth-batch-market] codex holders exception", e);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { addresses } = await req.json().catch(() => ({}));
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return json({ results: {} });
    }
    const valid = (addresses as string[])
      .filter((a) => typeof a === "string" && ETH_ADDR_RE.test(a))
      .map((a) => a.toLowerCase())
      .slice(0, 30);
    if (valid.length === 0) return json({ results: {} });

    // Run DexScreener (price/mc/vol/liq) and Codex (holders) in parallel
    const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${valid.join(",")}`;
    const [dexRes, holdersMap] = await Promise.all([
      fetch(dexUrl, { headers: { Accept: "application/json" } }).catch((e) => {
        console.error("[eth-batch-market] dexscreener fetch failed", e);
        return null;
      }),
      fetchCodexHolders(valid),
    ]);

    const out: Record<string, any> = {};

    if (dexRes && dexRes.ok) {
      const data = await dexRes.json();
      const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];

      for (const addr of valid) {
        const candidates = pairs.filter(
          (p) =>
            p?.chainId === "ethereum" &&
            (p?.baseToken?.address?.toLowerCase() === addr ||
              p?.quoteToken?.address?.toLowerCase() === addr)
        );
        if (candidates.length === 0) continue;
        candidates.sort(
          (a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0)
        );
        const p = candidates[0];
        out[addr] = {
          priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
          marketCap: p.fdv ?? p.marketCap ?? null,
          volumeH24: p.volume?.h24 ?? null,
          changeH24: p.priceChange?.h24 ?? null,
          liquidityUsd: p.liquidity?.usd ?? null,
          pairUrl: p.url ?? null,
          holders: holdersMap[addr] ?? null,
        };
      }
    } else if (dexRes) {
      console.error("[eth-batch-market] dexscreener error", dexRes.status);
    }

    // Ensure tokens with holders but no DexScreener data still surface holders
    for (const addr of valid) {
      if (!out[addr] && holdersMap[addr] != null) {
        out[addr] = {
          priceUsd: null,
          marketCap: null,
          volumeH24: null,
          changeH24: null,
          liquidityUsd: null,
          pairUrl: null,
          holders: holdersMap[addr],
        };
      }
    }

    return json({ results: out });
  } catch (e) {
    console.error("[eth-batch-market] error", e);
    return json({ results: {}, error: String(e) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
