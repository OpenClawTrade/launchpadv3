// ============================================================================
// eth-launch-finalize
//
// Called by the client AFTER the user has broadcast the deploy transaction
// (and optionally the LP-add / burn / renounce txs).
//
// Updates the launch record with:
//   - deploy_tx_hash, token_address
//   - lp_tx_hash, uniswap_pool_address
//   - status: "live" | "failed"
//   - error_message (if failed)
//
// No private keys involved. Server only updates the DB row.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isAddress, isHex } from "https://esm.sh/viem@2.45.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FinalizeBody {
  launchId: string;
  status: "live" | "failed";
  deployTxHash?: string;
  tokenAddress?: string;
  lpTxHash?: string;
  uniswapPoolAddress?: string;
  errorMessage?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => null)) as FinalizeBody | null;
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ success: false, error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.launchId || typeof body.launchId !== "string") {
      return new Response(JSON.stringify({ success: false, error: "launchId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.status !== "live" && body.status !== "failed") {
      return new Response(JSON.stringify({ success: false, error: "Invalid status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.deployTxHash && !isHex(body.deployTxHash)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid deployTxHash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.lpTxHash && !isHex(body.lpTxHash)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid lpTxHash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.tokenAddress && !isAddress(body.tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.uniswapPoolAddress && !isAddress(body.uniswapPoolAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid uniswapPoolAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ success: false, error: "Service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const update: Record<string, unknown> = { status: body.status };
    if (body.deployTxHash) update.deploy_tx_hash = body.deployTxHash;
    if (body.tokenAddress) update.token_address = body.tokenAddress.toLowerCase();
    if (body.lpTxHash) update.lp_tx_hash = body.lpTxHash;
    if (body.uniswapPoolAddress) update.uniswap_pool_address = body.uniswapPoolAddress.toLowerCase();
    if (body.errorMessage) update.error_message = body.errorMessage.slice(0, 500);

    const { data, error } = await supabase
      .from("eth_launch_requests")
      .update(update)
      .eq("id", body.launchId)
      .select("id, token_address, status")
      .single();

    if (error) {
      console.error("[eth-launch-finalize] update failed", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, launch: data }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[eth-launch-finalize] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
