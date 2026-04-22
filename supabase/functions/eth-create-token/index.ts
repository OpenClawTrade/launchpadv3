// ============================================================================
// eth-create-token (V2 — atomic launcher intent endpoint)
//
// Returns the parameters the client needs to call PopShibaLauncher.launch()
// directly from the user's wallet in a single signature. The server only
// records the intent — it never broadcasts.
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

interface LaunchBody {
  name: string;
  ticker: string;
  creatorWallet: string;
  ethForLPWei?: string; // client-computed: $50 worth of ETH at spot price
  devBuyEth?: number;   // optional, can be 0
  lockLP?: boolean;     // V3 only — opt-in Team Finance LP lock
  description?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
}

// LP bounds — absolute safety floor only. We do NOT enforce a minimum tied to
// any specific aggregator's threshold (none are publicly documented). The UI
// warns the user when LP is small; this server check just prevents zero/dust.
const MIN_LP_WEI = 1_000_000_000_000_000n; // 0.001 ETH absolute floor (~$3 safety)
const MAX_LP_WEI = 10_000_000_000_000_000_000n; // 10 ETH cap

function validate(body: any): { ok: true; data: LaunchBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { name, ticker, creatorWallet, devBuyEth, ethForLPWei } = body;
  if (typeof name !== "string" || name.trim().length < 1 || name.length > 32) return { ok: false, error: "Invalid name" };
  if (typeof ticker !== "string" || ticker.trim().length < 1 || ticker.length > 10) return { ok: false, error: "Invalid ticker" };
  if (!isEvmAddress(creatorWallet)) return { ok: false, error: "Invalid creator wallet" };
  if (devBuyEth !== undefined && devBuyEth !== null) {
    if (typeof devBuyEth !== "number" || !isFinite(devBuyEth) || devBuyEth < 0 || devBuyEth > 5) {
      return { ok: false, error: "devBuyEth must be 0..5" };
    }
  }
  if (ethForLPWei !== undefined && ethForLPWei !== null) {
    if (typeof ethForLPWei !== "string" || !/^\d+$/.test(ethForLPWei)) {
      return { ok: false, error: "ethForLPWei must be a wei string" };
    }
    const v = BigInt(ethForLPWei);
    if (v < MIN_LP_WEI || v > MAX_LP_WEI) {
      return { ok: false, error: "ethForLPWei out of bounds (0.001..10 ETH)" };
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

    // Fetch active deployment (V2 launcher address). Prefers explicit V2 column when present.
    const { data: deployment, error: depErr } = await supabase
      .from("eth_deployments")
      .select("launcher_address, clone_factory_address, vault_address, token_impl_address, uncx_lock_fee_wei")
      .eq("is_active", true)
      .not("launcher_address", "is", null)
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

    // On-chain metadata stored permanently in the token's metadataURI() getter.
    const metadataURI = JSON.stringify({
      name: body.name.trim(),
      symbol: body.ticker.trim().toUpperCase(),
      description: (body.description?.trim() || "").slice(0, 500),
      website: body.websiteUrl?.trim() || "",
      twitter: body.twitterUrl?.trim() || "",
      telegram: body.telegramUrl?.trim() || "",
      launchpad: "PopShiba.com",
      launchpadUrl: "https://popshiba.com",
      chain: "ethereum",
      launchedAt: new Date().toISOString(),
      launchId: launchId ?? "",
    });

    // LP seed amount (client-supplied, server-floored).
    const ethForLPWei = body.ethForLPWei ?? parseEther("0.02").toString();
    const ethForDevBuyWei = body.devBuyEth && body.devBuyEth > 0
      ? parseEther(String(body.devBuyEth)).toString()
      : "0";

    // Locker flat fee (UNCX on V2, Team Finance on V3). Stored as `uncx_lock_fee_wei`
    // on eth_deployments — column name is legacy; value is whatever the active locker
    // currently charges. Defaults to 0 if column never populated (V3 unlocked launches).
    const lockerFeeWei = (deployment as any).uncx_lock_fee_wei
      ? String((deployment as any).uncx_lock_fee_wei)
      : "0";

    // V3 only: respect the user's lockLP flag. If false → no locker fee added.
    // V2 launchers ignore this (they always lock and we always add the fee).
    const lockLP = body.lockLP === true;

    return new Response(JSON.stringify({
      success: true,
      launchId,
      launcher: launcherAddress,
      metadataURI,
      ethForLPWei,
      ethForDevBuyWei,
      // Legacy field — still emitted for V2 launcher clients.
      uncxLockFeeWei: lockLP ? lockerFeeWei : "0",
      // New canonical fields:
      lockerFeeWei: lockLP ? lockerFeeWei : "0",
      lockLP,
      cloneFactory: deployment.clone_factory_address,
      feeVault: deployment.vault_address,
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
