import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hash API key using HMAC-SHA256
async function hashApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(apiKey);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || !apiKey.startsWith("tna_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid API key required in x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");

    if (!apiEncryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Hash the provided API key and find matching agent
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agent's launched tokens with stats
    const { data: agentTokens } = await supabase
      .from("agent_tokens")
      .select(`
        id,
        source_platform,
        created_at,
        fun_tokens (
          id,
          name,
          ticker,
          mint_address,
          image_url,
          market_cap_sol,
          volume_24h_sol,
          created_at
        )
      `)
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });

    // Get token IDs for fee calculation
    const tokenIds = (agentTokens || [])
      .map(at => (at.fun_tokens as any)?.id)
      .filter(Boolean);

    // Calculate fees dynamically from fun_fee_claims (source of truth)
    let calculatedFeesEarned = 0;
    const tokenFeesMap: Record<string, number> = {};
    if (tokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("fun_token_id, claimed_sol")
        .in("fun_token_id", tokenIds);
      
      (feeClaims || []).forEach(claim => {
        if (claim.fun_token_id) {
          tokenFeesMap[claim.fun_token_id] = (tokenFeesMap[claim.fun_token_id] || 0) + Number(claim.claimed_sol || 0);
        }
      });
      calculatedFeesEarned = Object.values(tokenFeesMap).reduce((sum, v) => sum + v, 0) * 0.8;
    }

    // Calculate pending fees
    const { data: pendingFees } = await supabase
      .from("agent_fee_distributions")
      .select("amount_sol")
      .eq("agent_id", agent.id)
      .eq("status", "pending");

    const pendingAmount = (pendingFees || []).reduce((sum, f) => sum + Number(f.amount_sol || 0), 0);

    // Transform tokens data
    const tokens = (agentTokens || []).map((at) => {
      const token = at.fun_tokens as any;
      return token ? {
        id: token.id,
        name: token.name,
        symbol: token.ticker,
        mintAddress: token.mint_address,
        imageUrl: token.image_url,
        marketCapSol: Number(token.market_cap_sol || 0),
        volume24hSol: Number(token.volume_24h_sol || 0),
        feesGenerated: (tokenFeesMap[token.id] || 0) * 0.8, // 80% agent share from actual claims
        launchedAt: token.created_at,
        sourcePlatform: at.source_platform,
      } : null;
    }).filter(Boolean);

    return new Response(
      JSON.stringify({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          walletAddress: agent.wallet_address,
          apiKeyPrefix: agent.api_key_prefix,
          totalTokensLaunched: agent.total_tokens_launched || 0,
          totalFeesEarned: calculatedFeesEarned,
          totalFeesClaimed: Number(agent.total_fees_claimed_sol || 0),
          pendingFees: Math.max(0, calculatedFeesEarned - Number(agent.total_fees_claimed_sol || 0)),
          launchesToday: agent.launches_today || 0,
          lastLaunchAt: agent.last_launch_at,
          status: agent.status,
          createdAt: agent.created_at,
        },
        tokens,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("agent-me error:", error);
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
