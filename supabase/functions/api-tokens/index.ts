import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);

    // GET: List tokens for a launchpad
    if (req.method === "GET") {
      const launchpadId = url.searchParams.get("launchpadId");
      const wallet = url.searchParams.get("wallet");

      if (!launchpadId) {
        return new Response(JSON.stringify({ error: "launchpadId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership if wallet provided
      if (wallet) {
        const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: wallet });
        if (!accounts || accounts.length === 0) {
          return new Response(JSON.stringify({ error: "No API account found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: lp } = await supabase
          .from("api_launchpads")
          .select("id")
          .eq("id", launchpadId)
          .eq("api_account_id", accounts[0].id)
          .single();

        if (!lp) {
          return new Response(JSON.stringify({ error: "Launchpad not found or unauthorized" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Get tokens linked to this launchpad
      const { data: links, error } = await supabase
        .from("api_launchpad_tokens")
        .select(`
          id,
          token_id,
          created_at,
          tokens:token_id (
            id,
            name,
            ticker,
            mint_address,
            image_url,
            price_sol,
            volume_24h_sol,
            market_cap_sol,
            status
          )
        `)
        .eq("launchpad_id", launchpadId);

      if (error) throw error;

      const tokens = links?.map((l: any) => ({
        linkId: l.id,
        linkedAt: l.created_at,
        ...l.tokens,
      })) || [];

      return new Response(JSON.stringify({ tokens }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Link token to launchpad
    if (req.method === "POST") {
      const body = await req.json();
      const { launchpadId, tokenId, mintAddress, wallet } = body;

      if (!launchpadId || (!tokenId && !mintAddress)) {
        return new Response(JSON.stringify({ error: "launchpadId and tokenId or mintAddress required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!wallet) {
        return new Response(JSON.stringify({ error: "wallet required for authentication" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: wallet });
      if (!accounts || accounts.length === 0) {
        return new Response(JSON.stringify({ error: "No API account found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: lp } = await supabase
        .from("api_launchpads")
        .select("id")
        .eq("id", launchpadId)
        .eq("api_account_id", accounts[0].id)
        .single();

      if (!lp) {
        return new Response(JSON.stringify({ error: "Launchpad not found or unauthorized" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find token
      let resolvedTokenId = tokenId;
      if (!resolvedTokenId && mintAddress) {
        const { data: token } = await supabase
          .from("tokens")
          .select("id")
          .eq("mint_address", mintAddress)
          .single();

        if (!token) {
          return new Response(JSON.stringify({ error: "Token not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        resolvedTokenId = token.id;
      }

      // Check if already linked
      const { data: existing } = await supabase
        .from("api_launchpad_tokens")
        .select("id")
        .eq("launchpad_id", launchpadId)
        .eq("token_id", resolvedTokenId)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: "Token already linked to this launchpad" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Link token
      const { data: link, error } = await supabase
        .from("api_launchpad_tokens")
        .insert({
          launchpad_id: launchpadId,
          token_id: resolvedTokenId,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, link }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: Unlink token from launchpad
    if (req.method === "DELETE") {
      const linkId = url.searchParams.get("linkId");
      const wallet = url.searchParams.get("wallet");

      if (!linkId) {
        return new Response(JSON.stringify({ error: "linkId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!wallet) {
        return new Response(JSON.stringify({ error: "wallet required for authentication" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: wallet });
      if (!accounts || accounts.length === 0) {
        return new Response(JSON.stringify({ error: "No API account found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get link and verify launchpad ownership
      const { data: link } = await supabase
        .from("api_launchpad_tokens")
        .select("id, launchpad_id")
        .eq("id", linkId)
        .single();

      if (!link) {
        return new Response(JSON.stringify({ error: "Link not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: lp } = await supabase
        .from("api_launchpads")
        .select("id")
        .eq("id", link.launchpad_id)
        .eq("api_account_id", accounts[0].id)
        .single();

      if (!lp) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete link
      const { error } = await supabase
        .from("api_launchpad_tokens")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("API Tokens error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
