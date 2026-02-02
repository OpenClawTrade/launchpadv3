// Agent tokens edge function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "new";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build query with join to fun_tokens and agents
    let query = supabase
      .from("agent_tokens")
      .select(`
        id,
        agent_id,
        fun_token_id,
        source_platform,
        source_post_url,
        created_at,
        agents (
          id,
          name,
          wallet_address
        ),
        fun_tokens (
          id,
          name,
          ticker,
          mint_address,
          description,
          image_url,
          market_cap_sol,
          volume_24h_sol,
          price_change_24h,
          price_sol,
          holder_count,
          bonding_progress,
          created_at
        )
      `)
      .limit(limit);

    // Apply sorting
    switch (sort) {
      case "hot":
        // Hot = combination of recent + volume
        query = query.order("created_at", { ascending: false });
        break;
      case "mcap":
        // We'll sort client-side since we're joining
        query = query.order("created_at", { ascending: false });
        break;
      case "volume":
        query = query.order("created_at", { ascending: false });
        break;
      case "new":
      default:
        query = query.order("created_at", { ascending: false });
    }

    const { data: agentTokens, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch agent tokens: ${error.message}`);
    }

    // Transform and sort the data
    let tokens = (agentTokens || []).map((at) => {
      const token = at.fun_tokens as any;
      const agent = at.agents as any;
      return {
        id: at.id,
        agentId: at.agent_id,
        agentName: agent?.name || "Unknown Agent",
        agentWallet: agent?.wallet_address,
        funTokenId: at.fun_token_id,
        sourcePlatform: at.source_platform,
        sourcePostUrl: at.source_post_url,
        createdAt: at.created_at,
        token: token ? {
          id: token.id,
          name: token.name,
          ticker: token.ticker,
          mintAddress: token.mint_address,
          description: token.description,
          imageUrl: token.image_url,
          marketCapSol: Number(token.market_cap_sol || 0),
          volume24hSol: Number(token.volume_24h_sol || 0),
          priceChange24h: Number(token.price_change_24h || 0),
          priceSol: Number(token.price_sol || 0),
          holderCount: token.holder_count || 0,
          bondingProgress: Number(token.bonding_progress || 0),
          createdAt: token.created_at,
        } : null,
      };
    }).filter(t => t.token !== null);

    // Apply client-side sorting for mcap and volume
    if (sort === "mcap") {
      tokens = tokens.sort((a, b) => (b.token?.marketCapSol || 0) - (a.token?.marketCapSol || 0));
    } else if (sort === "volume") {
      tokens = tokens.sort((a, b) => (b.token?.volume24hSol || 0) - (a.token?.volume24hSol || 0));
    } else if (sort === "hot") {
      // Hot = recent tokens with high volume
      tokens = tokens.sort((a, b) => {
        const aScore = (b.token?.volume24hSol || 0) * 0.7 + (new Date(a.createdAt).getTime() / 1000000000) * 0.3;
        const bScore = (a.token?.volume24hSol || 0) * 0.7 + (new Date(b.createdAt).getTime() / 1000000000) * 0.3;
        return bScore - aScore;
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokens,
        count: tokens.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("agent-tokens error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
