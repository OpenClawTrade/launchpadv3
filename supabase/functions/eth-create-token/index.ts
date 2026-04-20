// Ethereum token creation edge function (scaffold)
// Adapted from base-create-token. Deploys ERC-20 with custom LP, taxes, burn, renounce on Ethereum mainnet.
// NOTE: Actual on-chain deployment requires ETHEREUM_RPC_URL + DEPLOYER_PRIVATE_KEY secrets.
// This scaffold validates input, persists the launch request, and returns a placeholder response
// until the deployment contract + secrets are wired by the operator.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LaunchBody {
  name: string;
  ticker: string;
  creatorWallet: string;
  lpEth: number;
  userTaxBps: number;
  platformTaxBps: number;
  burnLp: boolean;
  renounce: boolean;
  description?: string | null;
  imageUrl?: string | null;
  websiteUrl?: string | null;
  twitterUrl?: string | null;
  telegramUrl?: string | null;
}

function validate(body: any): { ok: true; data: LaunchBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { name, ticker, creatorWallet, lpEth, userTaxBps, platformTaxBps } = body;
  if (typeof name !== "string" || name.length < 1 || name.length > 32) return { ok: false, error: "Invalid name" };
  if (typeof ticker !== "string" || ticker.length < 1 || ticker.length > 10) return { ok: false, error: "Invalid ticker" };
  if (typeof creatorWallet !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(creatorWallet)) {
    return { ok: false, error: "Invalid creator wallet" };
  }
  if (typeof lpEth !== "number" || lpEth <= 0 || lpEth > 1000) return { ok: false, error: "Invalid lpEth" };
  if (typeof userTaxBps !== "number" || userTaxBps < 0 || userTaxBps > 300) return { ok: false, error: "userTaxBps must be 0–300 (0–3%)" };
  if (typeof platformTaxBps !== "number" || platformTaxBps !== 100) return { ok: false, error: "Platform tax must be 1% (100 bps)" };
  return { ok: true, data: body as LaunchBody };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const json = await req.json().catch(() => null);
    const result = validate(json);
    if (!result.ok) {
      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = result.data;
    const totalTaxBps = body.userTaxBps + body.platformTaxBps;

    console.log("[eth-create-token] launch request", {
      name: body.name,
      ticker: body.ticker,
      creator: body.creatorWallet,
      lpEth: body.lpEth,
      userTaxBps: body.userTaxBps,
      platformTaxBps: body.platformTaxBps,
      totalTaxBps,
      burnLp: body.burnLp,
      renounce: body.renounce,
    });

    // Optional: persist launch intent for tracking (best-effort, non-fatal)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase.from("eth_launch_requests").insert({
          creator_wallet: body.creatorWallet,
          token_name: body.name,
          token_ticker: body.ticker.toUpperCase(),
          lp_eth: body.lpEth,
          user_tax_bps: body.userTaxBps,
          platform_tax_bps: body.platformTaxBps,
          burn_lp: body.burnLp,
          renounce: body.renounce,
          description: body.description ?? null,
          image_url: body.imageUrl ?? null,
          website_url: body.websiteUrl ?? null,
          twitter_url: body.twitterUrl ?? null,
          telegram_url: body.telegramUrl ?? null,
          status: "pending_deployment",
        });
      } catch (e) {
        console.warn("[eth-create-token] persist skipped:", e instanceof Error ? e.message : e);
      }
    }

    // TODO (operator): wire the actual on-chain deployment using ethers + deployer key.
    // Until secrets/contracts are configured, return a clear pending response.
    const ethRpcUrl = Deno.env.get("ETHEREUM_RPC_URL");
    const deployerKey = Deno.env.get("ETHEREUM_DEPLOYER_PRIVATE_KEY");
    if (!ethRpcUrl || !deployerKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Ethereum deployer not configured. Add ETHEREUM_RPC_URL and ETHEREUM_DEPLOYER_PRIVATE_KEY secrets to enable launches.",
          pending: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Placeholder success path (replace with real deployment result)
    return new Response(
      JSON.stringify({
        success: false,
        error: "Deployment pipeline not yet implemented in this scaffold.",
        pending: true,
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[eth-create-token] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
