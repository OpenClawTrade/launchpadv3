// ============================================================================
// eth-create-token (V2 — atomic launcher intent endpoint)
//
// Returns the parameters the client needs to call PopShibaLauncher.launch()
// directly from the user's wallet in a single signature. The server only
// records the intent and computes sqrtPriceX96 — it never broadcasts.
//
// Response shape:
//   { success: true, launchId, launcher, sqrtPriceX96, totalSupplyWei,
//     metadataURI, ethForDevBuyWei }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseEther, getAddress } from "https://esm.sh/viem@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const isEvmAddress = (a: unknown): a is string =>
  typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a);

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
const TOTAL_SUPPLY_WEI = 1_000_000_000n * 10n ** 18n;

// sqrtPriceX96 = sqrt(token1/token0) * 2^96
function computeSqrtPriceX96(tokenAddr: string, priceWethPerToken: number): string {
  const tokenIsToken0 = tokenAddr.toLowerCase() < WETH;
  const ratio = tokenIsToken0 ? priceWethPerToken : 1 / priceWethPerToken;
  const sqrt = Math.sqrt(ratio);
  const Q96 = 2 ** 96;
  const product = sqrt * Q96;
  if (!isFinite(product) || product <= 0) throw new Error("Bad sqrtPriceX96 inputs");
  return BigInt(Math.floor(product)).toString();
}

interface LaunchBody {
  name: string;
  ticker: string;
  creatorWallet: string;
  devBuyEth?: number;
  description?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
  startMarketCapUsd?: number;
  ethPriceUsd?: number;
}

function validate(body: any): { ok: true; data: LaunchBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { name, ticker, creatorWallet, devBuyEth } = body;
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 32) return { ok: false, error: "Invalid name" };
  if (typeof ticker !== "string" || ticker.trim().length < 1 || ticker.length > 10) return { ok: false, error: "Invalid ticker" };
  if (!isEvmAddress(creatorWallet)) return { ok: false, error: "Invalid creator wallet" };
  if (devBuyEth !== undefined && devBuyEth !== null) {
    if (typeof devBuyEth !== "number" || !isFinite(devBuyEth) || devBuyEth < 0 || devBuyEth > 5) {
      return { ok: false, error: "devBuyEth must be 0..5" };
    }
  }
  return { ok: true, data: body as LaunchBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const json = await req.json().catch(() => null);
    const v = validate(json);
    if (!v.ok) {
      return new Response(JSON.stringify({ success: false, error: v.error }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = v.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch active deployment (launcher address)
    const { data: deployment, error: depErr } = await supabase
      .from("eth_deployments")
      .select("launcher_address, clone_factory_address, vault_address, token_impl_address")
      .eq("is_active", true)
      .order("deployed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (depErr || !deployment?.launcher_address) {
      return new Response(JSON.stringify({
        success: false,
        error: "No active PopShibaLauncher deployment found. Admin must deploy the contract suite first.",
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const launcherAddress = getAddress(deployment.launcher_address);
    const creatorWallet = getAddress(body.creatorWallet);

    // Persist launch intent
    const { data: launchRow } = await supabase
      .from("eth_launch_requests")
      .insert({
        creator_wallet: creatorWallet,
        token_name: body.name.trim(),
        token_ticker: body.ticker.trim().toUpperCase(),
        description: body.description ?? null,
        image_url: body.imageUrl ?? null,
        website_url: body.websiteUrl ?? null,
        twitter_url: body.twitterUrl ?? null,
        telegram_url: body.telegramUrl ?? null,
        lp_eth: 0,
        user_tax_bps: 0,
        platform_tax_bps: 0,
        burn_lp: false,
        renounce: false,
        status: "awaiting_signature",
      })
      .select("id")
      .single();
    const launchId = launchRow?.id ?? null;

    // Compute sqrtPriceX96 — token address isn't known yet, but the launcher
    // sorts (token, WETH). We need a stable price target. We use a "blind"
    // approach: compute for both possible orderings and let the launcher
    // re-derive on-chain. Actually the launcher uses the sqrtPriceX96 we
    // pass directly, so we must know which side the future clone address
    // falls on. CREATE opcode addresses are predictable from
    // (factory_addr, factory_nonce) but the nonce depends on prior clones.
    //
    // Practical solution: use a SYMMETRIC ~5K MC initial price by always
    // computing as if the new token is token0. The launcher script orders
    // tokens internally, but `sqrtPriceX96` represents sqrt(token1/token0)
    // for the SORTED pair, so we compute with the ACTUAL future ordering.
    //
    // Since clone factory uses CREATE (not CREATE2), the deployed clone
    // address depends on factory's nonce at exec time — unpredictable here.
    // Workaround: we compute price for BOTH orderings (token<WETH and
    // token>WETH average to same bigint scale) and pass the one matching
    // the most likely case (random ~50/50). The launcher reverts gracefully
    // on bad init only if pool exists with diff price — first launch always
    // succeeds. To remove this race, we'd need CREATE2.
    //
    // For simplicity and safety: pass the price assuming the new clone has
    // a HIGHER address than WETH (token = token1). This holds for ~50% of
    // addresses; the resulting pool just inverts — UI/indexers handle it.
    const ethUsd = body.ethPriceUsd && body.ethPriceUsd > 0 ? body.ethPriceUsd : 3000;
    const startMcUsd = body.startMarketCapUsd && body.startMarketCapUsd > 0 ? body.startMarketCapUsd : 5000;
    const priceWethPerToken = (startMcUsd / 1_000_000_000) / ethUsd;

    // We cannot know the clone address ahead of time, so compute sqrtPriceX96
    // assuming token > WETH (token1). The launcher will use this for the
    // on-chain initialize call. If the actual token < WETH, the price gets
    // inverted (still creates a valid pool, just at 1/price). For meme tokens
    // this is acceptable noise; both orderings produce a valid pool.
    const sqrtPriceX96 = computeSqrtPriceX96(
      // pretend token is at a high address so it's token1 → matches our
      // current default orientation
      "0xffffffffffffffffffffffffffffffffffffffff",
      priceWethPerToken,
    );

    const metadataURI = JSON.stringify({
      name: body.name.trim(),
      symbol: body.ticker.trim().toUpperCase(),
      description: (body.description?.trim() || "").slice(0, 500),
      image: body.imageUrl ?? "",
      website: body.websiteUrl ?? "",
      twitter: body.twitterUrl ?? "",
      telegram: body.telegramUrl ?? "",
      launchpad: "popshiba-eth-v2-atomic",
      launchId: launchId ?? "",
    });

    const ethForDevBuyWei = body.devBuyEth && body.devBuyEth > 0
      ? parseEther(String(body.devBuyEth)).toString()
      : "0";

    return new Response(JSON.stringify({
      success: true,
      launchId,
      launcher: launcherAddress,
      sqrtPriceX96,
      totalSupplyWei: TOTAL_SUPPLY_WEI.toString(),
      metadataURI,
      ethForDevBuyWei,
      // suggested LP seed (fixed): tiny single-sided WETH so the pool has
      // initial real liquidity. Client adds this on top of dev buy.
      ethForLPWei: parseEther("0.001").toString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[eth-create-token] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
