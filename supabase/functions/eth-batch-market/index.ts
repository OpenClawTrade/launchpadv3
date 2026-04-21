// eth-batch-market
// Batch-fetch on-chain market data (price, market cap, 24h volume, 24h change,
// liquidity) for ETH-mainnet token addresses via DexScreener.
//
// Input:  { addresses: string[] }   // ETH addresses, max 30 per call
// Output: { results: Record<lowercaseAddress, {
//            priceUsd, marketCap, volumeH24, changeH24, liquidityUsd, pairUrl
//          }> }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

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

    // DexScreener batch endpoint: comma-separated, max 30
    const url = `https://api.dexscreener.com/latest/dex/tokens/${valid.join(",")}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error("[eth-batch-market] dexscreener error", res.status);
      return json({ results: {} });
    }
    const data = await res.json();
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];

    // For each token, pick the highest-liquidity ETH-mainnet pair
    const out: Record<string, any> = {};
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
        marketCap: p.marketCap ?? p.fdv ?? null,
        volumeH24: p.volume?.h24 ?? null,
        changeH24: p.priceChange?.h24 ?? null,
        liquidityUsd: p.liquidity?.usd ?? null,
        pairUrl: p.url ?? null,
      };
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
