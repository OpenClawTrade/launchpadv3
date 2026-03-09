const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL = 3 * 60 * 1000;
let cachedData: unknown = null;
let cachedAt = 0;

type ProtocolRow = {
  name: string;
  vol24hUsd: number;
  change24h: number;
};

type DexStats = {
  volume24hUsd: number;
  buyCount24h: number;
  sellCount24h: number;
  buyers24h: number;
  sellers24h: number;
};

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 9000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchSolPriceUsd(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {}, 7000);
    if (!res.ok) return 0;
    const json = await res.json();
    return Number(json?.solana?.usd || 0);
  } catch {
    return 0;
  }
}

async function fetchDefiLlamaDexOverview() {
  try {
    const res = await fetchWithTimeout(
      "https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
    );
    if (!res.ok) return null;

    const json = await res.json();
    const total24h = Number(json?.total24h || 0);
    const prev24h = Number(json?.total48hto24h || 0);
    const change24h = prev24h > 0 ? ((total24h - prev24h) / prev24h) * 100 : 0;

    const protocols: ProtocolRow[] = (Array.isArray(json?.protocols) ? json.protocols : [])
      .map((p: any) => {
        const vol24hUsd = Number(p?.total24h || 0);
        const prevProtocol24h = Number(p?.total48hto24h || 0);
        const protocolChange24h = prevProtocol24h > 0
          ? ((vol24hUsd - prevProtocol24h) / prevProtocol24h) * 100
          : 0;

        return {
          name: String(p?.name || p?.displayName || "Unknown"),
          vol24hUsd,
          change24h: protocolChange24h,
        };
      })
      .filter((p: ProtocolRow) => p.vol24hUsd > 0)
      .sort((a: ProtocolRow, b: ProtocolRow) => b.vol24hUsd - a.vol24hUsd);

    return {
      total24hUsd: total24h,
      change24h,
      protocols,
    };
  } catch {
    return null;
  }
}

async function fetchGeckoDexPoolsStats(dexId: string): Promise<DexStats | null> {
  try {
    const res = await fetchWithTimeout(`https://api.geckoterminal.com/api/v2/networks/solana/dexes/${dexId}/pools?page=1`, {}, 9000);
    if (!res.ok) return null;

    const json = await res.json();
    const pools = Array.isArray(json?.data) ? json.data : [];

    let volume24hUsd = 0;
    let buyCount24h = 0;
    let sellCount24h = 0;
    let buyers24h = 0;
    let sellers24h = 0;

    for (const pool of pools) {
      const attributes = pool?.attributes || {};
      const h24Tx = attributes?.transactions?.h24 || {};

      volume24hUsd += Number(attributes?.volume_usd?.h24 || 0);
      buyCount24h += Number(h24Tx?.buys || 0);
      sellCount24h += Number(h24Tx?.sells || 0);
      buyers24h += Number(h24Tx?.buyers || 0);
      sellers24h += Number(h24Tx?.sellers || 0);
    }

    return {
      volume24hUsd,
      buyCount24h,
      sellCount24h,
      buyers24h,
      sellers24h,
    };
  } catch {
    return null;
  }
}

function aggregateDexStats(rows: Array<DexStats | null>): DexStats {
  return rows.reduce(
    (acc, row) => ({
      volume24hUsd: acc.volume24hUsd + Number(row?.volume24hUsd || 0),
      buyCount24h: acc.buyCount24h + Number(row?.buyCount24h || 0),
      sellCount24h: acc.sellCount24h + Number(row?.sellCount24h || 0),
      buyers24h: acc.buyers24h + Number(row?.buyers24h || 0),
      sellers24h: acc.sellers24h + Number(row?.sellers24h || 0),
    }),
    { volume24hUsd: 0, buyCount24h: 0, sellCount24h: 0, buyers24h: 0, sellers24h: 0 },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      return new Response(JSON.stringify(cachedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [solPriceUsd, dexOverview, pumpStats, bonkStats, moonshotStats] = await Promise.all([
      fetchSolPriceUsd(),
      fetchDefiLlamaDexOverview(),
      aggregateDexStats(await Promise.all([
        fetchGeckoDexPoolsStats("pump-fun"),
        fetchGeckoDexPoolsStats("pumpswap"),
      ])),
      aggregateDexStats(await Promise.all([
        fetchGeckoDexPoolsStats("raydium-launchlab"),
      ])),
      aggregateDexStats(await Promise.all([
        fetchGeckoDexPoolsStats("moonit"),
      ])),
    ]);

    const topProtocols = (dexOverview?.protocols || []).slice(0, 3).map((p) => ({
      name: p.name,
      vol24hUsd: p.vol24hUsd,
      change: p.change24h,
    }));

    const totalVol24hUsd = Number(dexOverview?.total24hUsd || 0);
    const volChange24h = Number(dexOverview?.change24h || 0);

    const launchpads = [
      { type: "pumpfun", stats: pumpStats },
      { type: "bonk", stats: bonkStats },
      { type: "moonshot", stats: moonshotStats },
    ].map((lp) => ({
      type: lp.type,
      vol24hUsd: lp.stats.volume24hUsd,
      vol24hSol: solPriceUsd > 0 ? lp.stats.volume24hUsd / solPriceUsd : 0,
      change: 0,
    }));

    const buyCount = pumpStats.buyCount24h + bonkStats.buyCount24h + moonshotStats.buyCount24h;
    const sellCount = pumpStats.sellCount24h + bonkStats.sellCount24h + moonshotStats.sellCount24h;
    const buyVolUsd = pumpStats.volume24hUsd + bonkStats.volume24hUsd + moonshotStats.volume24hUsd;

    const totalLocalVolUsd = buyVolUsd;
    const totalTrades = buyCount + sellCount;

    const response = {
      totalVol24hUsd,
      volChange24h,
      solPrice: solPriceUsd,

      totalTrades,
      tradesChange: 0,
      uniqueTraders: pumpStats.buyers24h + bonkStats.buyers24h + moonshotStats.buyers24h,
      tradersChange: 0,

      buyCount,
      buyVolUsd: totalLocalVolUsd * (buyCount + sellCount > 0 ? buyCount / (buyCount + sellCount) : 0.5),
      buyVolSol: solPriceUsd > 0
        ? (totalLocalVolUsd * (buyCount + sellCount > 0 ? buyCount / (buyCount + sellCount) : 0.5)) / solPriceUsd
        : 0,
      sellCount,
      sellVolUsd: totalLocalVolUsd * (buyCount + sellCount > 0 ? sellCount / (buyCount + sellCount) : 0.5),
      sellVolSol: solPriceUsd > 0
        ? (totalLocalVolUsd * (buyCount + sellCount > 0 ? sellCount / (buyCount + sellCount) : 0.5)) / solPriceUsd
        : 0,
      ownVolUsd: totalLocalVolUsd,

      tokensCreated: 0,
      created24h: 0,
      createdChange: 0,
      migrations: 0,
      graduated24h: 0,
      graduatedChange: 0,

      topProtocols,
      topLaunchpads: launchpads,

      updatedAt: new Date().toISOString(),
    };

    cachedData = response;
    cachedAt = Date.now();

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
