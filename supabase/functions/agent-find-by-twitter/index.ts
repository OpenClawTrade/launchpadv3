import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Find unclaimed agents by Twitter username.
 * Used by the claim page to show which agents a Twitter user can claim.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { twitterUsername } = await req.json();

    if (!twitterUsername || typeof twitterUsername !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "twitterUsername is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize username (remove @ if present, lowercase)
    const normalizedUsername = twitterUsername.replace(/^@/, "").toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find unclaimed agents matching this Twitter username
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select(`
        id,
        name,
        wallet_address,
        verified_at,
        created_at,
        avatar_url,
        description,
        style_source_username,
        total_tokens_launched
      `)
      .ilike("style_source_username", normalizedUsername)
      .is("verified_at", null)
      .order("created_at", { ascending: false });

    if (agentsError) {
      console.error("[agent-find-by-twitter] Query error:", agentsError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get token info for each agent
    const agentsWithTokens = await Promise.all(
      (agents || []).map(async (agent) => {
        const { data: tokens } = await supabase
          .from("fun_tokens")
          .select("id, ticker, mint_address, image_url, created_at")
          .eq("agent_id", agent.id)
          .order("created_at", { ascending: false })
          .limit(5);

        return {
          id: agent.id,
          name: agent.name,
          walletAddress: agent.wallet_address,
          avatarUrl: agent.avatar_url,
          description: agent.description,
          launchedAt: agent.created_at,
          tokensLaunched: agent.total_tokens_launched || 0,
          verified: false,
          tokens: (tokens || []).map((t) => ({
            symbol: t.ticker,
            mint: t.mint_address,
            imageUrl: t.image_url,
          })),
        };
      })
    );

    console.log(
      `[agent-find-by-twitter] Found ${agentsWithTokens.length} unclaimed agents for @${normalizedUsername}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        twitterUsername: normalizedUsername,
        agents: agentsWithTokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-find-by-twitter] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
