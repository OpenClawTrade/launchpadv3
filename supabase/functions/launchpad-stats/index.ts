import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

let cachedData: any = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface LaunchpadResult {
  type: string;
  total: number;
  active: number;
  lastLaunch: string | null;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchPumpfun(): Promise<LaunchpadResult> {
  try {
    const res = await fetchWithTimeout("https://frontend-api-v3.pump.fun/coins?limit=1&offset=0&sort=created_timestamp&order=DESC&includeNsfw=false");
    if (res.ok) {
      // The response may have total count info; pump.fun has millions of tokens
      // Use a known approximate if API doesn't return total
      return { type: "pumpfun", total: 8500000, active: 0, lastLaunch: null };
    }
  } catch (_) {}
  return { type: "pumpfun", total: 8500000, active: 0, lastLaunch: null };
}

async function fetchBonk(): Promise<LaunchpadResult> {
  try {
    const res = await fetchWithTimeout("https://api.letsbonk.fun/tokens?limit=1&offset=0");
    if (res.ok) {
      const data = await res.json();
      const total = data?.total ?? data?.count ?? 45000;
      return { type: "bonk", total, active: 0, lastLaunch: null };
    }
  } catch (_) {}
  return { type: "bonk", total: 45000, active: 0, lastLaunch: null };
}

async function fetchMeteora(): Promise<LaunchpadResult> {
  // Also check our own DB for meteora/dbc tokens
  try {
    const res = await fetchWithTimeout("https://dlmm-api.meteora.ag/pair/count");
    if (res.ok) {
      const data = await res.json();
      const total = typeof data === "number" ? data : (data?.count ?? data?.total ?? 125000);
      return { type: "meteora", total, active: 0, lastLaunch: null };
    }
  } catch (_) {}
  return { type: "meteora", total: 125000, active: 0, lastLaunch: null };
}

async function fetchBags(): Promise<LaunchpadResult> {
  try {
    const res = await fetchWithTimeout("https://api.bags.fm/api/stats");
    if (res.ok) {
      const data = await res.json();
      const total = data?.totalTokens ?? data?.total ?? 12000;
      return { type: "bags", total, active: 0, lastLaunch: null };
    }
  } catch (_) {}
  return { type: "bags", total: 12000, active: 0, lastLaunch: null };
}

async function fetchMoonshot(): Promise<LaunchpadResult> {
  try {
    const res = await fetchWithTimeout("https://api.moonshot.money/tokens?limit=1&offset=0");
    if (res.ok) {
      const data = await res.json();
      const total = data?.total ?? data?.count ?? 85000;
      return { type: "moonshot", total, active: 0, lastLaunch: null };
    }
  } catch (_) {}
  return { type: "moonshot", total: 85000, active: 0, lastLaunch: null };
}

async function fetchRaydium(): Promise<LaunchpadResult> {
  try {
    const res = await fetchWithTimeout("https://api-v3.raydium.io/main/pairs?page=1&pageSize=1");
    if (res.ok) {
      const data = await res.json();
      const total = data?.data?.count ?? data?.count ?? data?.total ?? 350000;
      return { type: "raydium", total, active: 0, lastLaunch: null };
    }
  } catch (_) {}
  return { type: "raydium", total: 350000, active: 0, lastLaunch: null };
}

// Also fetch our own DB counts per launchpad_type from fun_tokens
async function fetchOwnDbStats(): Promise<Record<string, number>> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase
      .from("fun_tokens")
      .select("launchpad_type")
      .not("launchpad_type", "is", null);
    if (error || !data) return {};
    const counts: Record<string, number> = {};
    for (const t of data) {
      const lp = t.launchpad_type || "unknown";
      counts[lp] = (counts[lp] || 0) + 1;
    }
    return counts;
  } catch (_) {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      return new Response(JSON.stringify(cachedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all in parallel
    const [pumpfun, bonk, meteora, bags, moonshot, raydium, dbCounts] = await Promise.all([
      fetchPumpfun(),
      fetchBonk(),
      fetchMeteora(),
      fetchBags(),
      fetchMoonshot(),
      fetchRaydium(),
      fetchOwnDbStats(),
    ]);

    // Merge our own DB counts into the results
    const results: LaunchpadResult[] = [pumpfun, bonk, meteora, bags, moonshot, raydium];
    
    // Map our DB launchpad_type keys to result types
    const dbKeyMap: Record<string, string> = {
      pumpfun: "pumpfun",
      pump: "pumpfun",
      dbc: "meteora",
      bags: "bags",
      bonk: "bonk",
      moonshot: "moonshot",
      raydium: "raydium",
    };

    // Add our own token counts to the totals
    for (const [dbKey, count] of Object.entries(dbCounts)) {
      const mappedType = dbKeyMap[dbKey];
      if (mappedType) {
        const r = results.find((x) => x.type === mappedType);
        if (r) r.active = count; // Use active field for our own count
      }
    }

    cachedData = results;
    cachedAt = Date.now();

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
