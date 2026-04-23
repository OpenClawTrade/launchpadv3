// ============================================================================
// eth-reverify-token
//
// Admin-callable utility that re-submits Etherscan verification for a single
// token (or every launch in a recent window) so the per-token metadata header
// shows on the Code tab instead of the SHIBANUSI similar-match page.
//
// POST body:
//   { tokenAddress: "0x..." }                  -> reverify one token
//   { allRecent: true, days?: number = 7 }     -> reverify every live launch in window
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_WALLETS = new Set(
  [
    "0xc596547700d9175b9807f405bed1a62a386dc8a3",
    "0xf3298f1d7779f41f87b3ac8f610f3637611a2eae",
  ].map((a) => a.toLowerCase())
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const requesterWallet = String(body?.adminWallet || req.headers.get("x-admin-wallet") || "").toLowerCase();
    if (!ADMIN_WALLETS.has(requesterWallet)) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let targets: string[] = [];

    if (body?.tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(body.tokenAddress)) {
      targets = [String(body.tokenAddress).toLowerCase()];
    } else if (body?.allRecent) {
      const days = Math.max(1, Math.min(30, Number(body?.days) || 7));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("eth_launch_requests")
        .select("token_address")
        .eq("status", "live")
        .gte("created_at", since)
        .not("token_address", "is", null);
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targets = (data || [])
        .map((r: any) => String(r.token_address || "").toLowerCase())
        .filter((a) => /^0x[a-f0-9]{40}$/.test(a));
    } else {
      return new Response(JSON.stringify({ success: false, error: "Provide tokenAddress or allRecent:true" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ tokenAddress: string; verified: boolean; message?: string; error?: string }> = [];

    for (const addr of targets) {
      try {
        const { data, error } = await supabase.functions.invoke("eth-verify-contract", {
          body: { tokenAddress: addr, waitForResult: true },
        });
        if (error) {
          results.push({ tokenAddress: addr, verified: false, error: error.message });
        } else {
          results.push({
            tokenAddress: addr,
            verified: !!data?.verified,
            message: data?.message || (data?.alreadyVerified ? "AlreadyVerified" : undefined),
          });
        }
      } catch (e) {
        results.push({ tokenAddress: addr, verified: false, error: e instanceof Error ? e.message : String(e) });
      }
      // Light rate-limit between Etherscan calls
      await new Promise((r) => setTimeout(r, 1500));
    }

    return new Response(JSON.stringify({
      success: true,
      total: results.length,
      verified: results.filter((r) => r.verified).length,
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[eth-reverify-token] error", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
