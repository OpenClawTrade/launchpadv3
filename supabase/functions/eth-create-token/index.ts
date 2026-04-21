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
  devBuyEth?: number;
  description?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
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

    const ethForLPWei = parseEther("0.0005").toString();           // ~$1.50 LP seed
    const ethForDevBuyWei = body.devBuyEth && body.devBuyEth > 0
      ? parseEther(String(body.devBuyEth)).toString()
      : "0";

    return new Response(JSON.stringify({
      success: true,
      launchId,
      launcher: launcherAddress,
      metadataURI,
      ethForLPWei,
      ethForDevBuyWei,
      // Expose suite addresses for transparency / explorer links
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
