// ============================================================================
// eth-launch-finalize
//
// Called after the user broadcasts launcher.launch(). Records the on-chain
// result in eth_launch_requests.
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
  launchTxHash?: string;
  tokenAddress?: string;
  poolAddress?: string;
  lpTokenId?: string;          // bigint stringified
  uncxLockId?: string;         // bigint stringified — UNCX V3 lock id
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
    if (body.launchTxHash && !isHex(body.launchTxHash)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid launchTxHash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.tokenAddress && !isAddress(body.tokenAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid tokenAddress" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.poolAddress && !isAddress(body.poolAddress)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid poolAddress" }), {
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
    if (body.launchTxHash) {
      update.launch_tx_hash = body.launchTxHash;
      update.deploy_tx_hash = body.launchTxHash; // legacy column
    }
    if (body.tokenAddress) update.token_address = body.tokenAddress.toLowerCase();
    if (body.poolAddress) update.uniswap_pool_address = body.poolAddress.toLowerCase();
    if (body.lpTokenId) {
      // Numeric column; stringified bigint is fine for postgres
      update.lp_token_id = body.lpTokenId;
    }
    if (body.uncxLockId) {
      update.uncx_lock_id = body.uncxLockId;
    }
    if (body.errorMessage) update.error_message = body.errorMessage.slice(0, 500);

    const { data, error } = await supabase
      .from("eth_launch_requests")
      .update(update)
      .eq("id", body.launchId)
      .select("id, token_address, uniswap_pool_address, lp_token_id, creator_wallet, status")
      .single();

    if (error) {
      console.error("[eth-launch-finalize] update failed", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Register the Uniswap V3 LP NFT so eth-collect-fees can find it. ──────
    // Without this row, creator fees never accrue in eth_creator_fee_ledger.
    if (
      body.status === "live" &&
      data?.token_address &&
      data?.uniswap_pool_address &&
      data?.lp_token_id
    ) {
      const { error: lpErr } = await supabase
        .from("eth_lp_positions")
        .upsert(
          {
            token_address: String(data.token_address).toLowerCase(),
            pool_address: String(data.uniswap_pool_address).toLowerCase(),
            lp_token_id: data.lp_token_id,
            creator_wallet: String(data.creator_wallet).toLowerCase(),
            platform_owner: "0x8f7017df748db75a58b3aa441ea0886dfec16906",
            fee_tier: 10000,
            tick_lower: -887200,
            tick_upper: 887200,
            chain_id: 1,
          },
          { onConflict: "token_address" }
        );
      if (lpErr) {
        // Don't fail the launch — just log so we can backfill later.
        console.error("[eth-launch-finalize] eth_lp_positions upsert failed", lpErr);
      }
    }

    // ── Kick off per-token Etherscan verification (fire-and-forget) so the ──
    // contract source page on Etherscan shows this launch's metadata header
    // (Name, Website, X, Telegram, Discord, Description) instead of "Similar
    // Match Source Code" pointing at the impl.
    if (body.status === "live" && data?.token_address) {
      try {
        // @ts-ignore — EdgeRuntime is a Deno deploy global
        EdgeRuntime.waitUntil((async () => {
          try {
            await supabase.functions.invoke("eth-verify-contract", {
              body: {
                tokenAddress: data.token_address,
                launchId: data.id,
                waitForResult: false,
              },
            });
          } catch (e) {
            console.error("[eth-launch-finalize] eth-verify-contract invoke failed", e);
          }
        })());
      } catch (e) {
        console.error("[eth-launch-finalize] failed to schedule verification", e);
      }

      // ── Warm GMGN's indexer / safety wallet so trades route immediately. ──
      // Without this, GMGN can take 1–24h to whitelist a brand-new pool, and
      // their wallet shows "Transaction failed 50001300" until then.
      try {
        // @ts-ignore — EdgeRuntime is a Deno deploy global
        EdgeRuntime.waitUntil((async () => {
          const ping = async (url: string) => {
            try {
              const res = await fetch(url, {
                method: "GET",
                headers: { "User-Agent": "Mozilla/5.0 PopShibaLaunchpad/1.0" },
              });
              console.log(`[eth-launch-finalize] indexer ping ${url} → ${res.status}`);
            } catch (e) {
              console.error(`[eth-launch-finalize] indexer ping failed ${url}`, e);
            }
          };
          // Public token-info endpoints — hitting them forces GMGN's backend
          // to index the pool. DexScreener is hit for parity.
          await Promise.all([
            ping(`https://gmgn.ai/api/v1/token_info/eth/${data.token_address}`),
            ping(`https://gmgn.ai/eth/token/${data.token_address}`),
            data.uniswap_pool_address
              ? ping(`https://api.dexscreener.com/latest/dex/pairs/ethereum/${data.uniswap_pool_address}`)
              : Promise.resolve(),
          ]);
        })());
      } catch (e) {
        console.error("[eth-launch-finalize] failed to schedule indexer pings", e);
      }
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
