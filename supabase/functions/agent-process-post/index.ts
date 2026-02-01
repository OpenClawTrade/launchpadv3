import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Use untyped client for flexibility with new tables
// deno-lint-ignore no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

interface ParsedLaunchData {
  name: string;
  symbol: string;
  wallet: string;
  description?: string;
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

// Parse the !tunalaunch post content
export function parseLaunchPost(content: string): ParsedLaunchData | null {
  // Check for the trigger command
  if (!content.toLowerCase().includes("!tunalaunch")) {
    return null;
  }

  const lines = content.split("\n").map((line) => line.trim());
  const data: Partial<ParsedLaunchData> = {};

  for (const line of lines) {
    // Match key: value patterns
    const match = line.match(/^(\w+)\s*[:=]\s*(.+)$/i);
    if (match) {
      const [, key, value] = match;
      const keyLower = key.toLowerCase();

      switch (keyLower) {
        case "name":
        case "token":
          data.name = value.trim().slice(0, 32);
          break;
        case "symbol":
        case "ticker":
          data.symbol = value.trim().toUpperCase().slice(0, 10);
          break;
        case "wallet":
        case "address":
        case "creator":
          data.wallet = value.trim();
          break;
        case "description":
        case "desc":
          data.description = value.trim().slice(0, 500);
          break;
        case "image":
        case "logo":
        case "img":
          data.image = value.trim();
          break;
        case "website":
        case "site":
        case "web":
          data.website = value.trim();
          break;
        case "twitter":
        case "x":
          data.twitter = value.trim();
          break;
        case "telegram":
        case "tg":
          data.telegram = value.trim();
          break;
        case "discord":
          data.discord = value.trim();
          break;
      }
    }
  }

  // Validate required fields
  if (!data.name || !data.symbol || !data.wallet) {
    return null;
  }

  // Validate wallet address format (Solana base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.wallet)) {
    return null;
  }

  return data as ParsedLaunchData;
}

// Get or create agent by wallet address
async function getOrCreateAgent(
  supabase: AnySupabase,
  walletAddress: string,
  name?: string
): Promise<{ id: string; wallet_address: string; name: string } | null> {
  // Try to find existing agent
  const { data: existing } = await supabase
    .from("agents")
    .select("id, wallet_address, name")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Create new agent (without API key since they're using social posts)
  const apiKeyPrefix = "tna_social_";
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const apiKeyHash = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: newAgent, error } = await supabase
    .from("agents")
    .insert({
      name: name || `Agent_${walletAddress.slice(0, 8)}`,
      wallet_address: walletAddress,
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      status: "active",
    })
    .select("id, wallet_address, name")
    .single();

  if (error) {
    console.error("[agent-process-post] Failed to create agent:", error);
    return null;
  }

  return newAgent;
}

// Check if agent has launched in last 24 hours
function isWithin24Hours(lastLaunchAt: string | null): boolean {
  if (!lastLaunchAt) return false;
  const lastLaunch = new Date(lastLaunchAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastLaunch.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24;
}

// Process a social post and launch token
export async function processLaunchPost(
  supabase: AnySupabase,
  platform: "twitter" | "telegram",
  postId: string,
  postUrl: string | null,
  postAuthor: string | null,
  postAuthorId: string | null,
  rawContent: string,
  meteoraApiUrl: string
): Promise<{
  success: boolean;
  mintAddress?: string;
  tradeUrl?: string;
  error?: string;
  socialPostId?: string;
}> {
  console.log(`[agent-process-post] Processing ${platform} post: ${postId}`);

  // Check if already processed
  const { data: existingPost } = await supabase
    .from("agent_social_posts")
    .select("id, status, fun_token_id")
    .eq("platform", platform)
    .eq("post_id", postId)
    .maybeSingle();

  if (existingPost) {
    console.log(`[agent-process-post] Post already processed: ${postId}`);
    return {
      success: false,
      error: "Post already processed",
      socialPostId: existingPost.id,
    };
  }

  // Parse the post content
  const parsed = parseLaunchPost(rawContent);
  if (!parsed) {
    // Insert as failed
    const { data: failedPost } = await supabase
      .from("agent_social_posts")
      .insert({
        platform,
        post_id: postId,
        post_url: postUrl,
        post_author: postAuthor,
        post_author_id: postAuthorId,
        wallet_address: "unknown",
        raw_content: rawContent.slice(0, 1000),
        status: "failed",
        error_message: "Failed to parse required fields (name, symbol, wallet)",
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    return {
      success: false,
      error: "Failed to parse post. Required: name, symbol, wallet",
      socialPostId: failedPost?.id,
    };
  }

  // Insert pending record
  const { data: socialPost, error: insertError } = await supabase
    .from("agent_social_posts")
    .insert({
      platform,
      post_id: postId,
      post_url: postUrl,
      post_author: postAuthor,
      post_author_id: postAuthorId,
      wallet_address: parsed.wallet,
      raw_content: rawContent.slice(0, 1000),
      parsed_name: parsed.name,
      parsed_symbol: parsed.symbol,
      parsed_description: parsed.description,
      parsed_image_url: parsed.image,
      parsed_website: parsed.website,
      parsed_twitter: parsed.twitter,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Duplicate
      return { success: false, error: "Post already being processed" };
    }
    console.error("[agent-process-post] Insert error:", insertError);
    return { success: false, error: "Database error" };
  }

  const socialPostId = socialPost.id;

  try {
    // Get or create agent
    const agent = await getOrCreateAgent(
      supabase,
      parsed.wallet,
      postAuthor || undefined
    );
    if (!agent) {
      throw new Error("Failed to get or create agent");
    }

    // Check rate limit
    const { data: agentData } = await supabase
      .from("agents")
      .select("last_launch_at, total_tokens_launched, launches_today")
      .eq("id", agent.id)
      .single();

    if (agentData && isWithin24Hours(agentData.last_launch_at)) {
      throw new Error("Rate limit: 1 launch per 24 hours");
    }

    // Update social post with agent ID
    await supabase
      .from("agent_social_posts")
      .update({ agent_id: agent.id })
      .eq("id", socialPostId);

    console.log(
      `[agent-process-post] Launching token for agent ${agent.name}: ${parsed.name} (${parsed.symbol})`
    );

    // Call Vercel API to create token
    const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: parsed.name,
        ticker: parsed.symbol,
        description:
          parsed.description ||
          `${parsed.name} - Launched via TUNA Agents on ${platform}`,
        imageUrl: parsed.image || null,
        websiteUrl: parsed.website || null,
        twitterUrl: parsed.twitter || null,
        serverSideSign: true,
        feeRecipientWallet: parsed.wallet,
        useVanityAddress: true,
      }),
    });

    const result = await vercelResponse.json();

    if (!vercelResponse.ok || !result.success) {
      throw new Error(result.error || "Token creation failed");
    }

    const mintAddress = result.mintAddress as string;
    const dbcPoolAddress = result.dbcPoolAddress as string | null;

    // Get or create fun_token record
    let funTokenId: string | null = null;

    const { data: existing } = await supabase
      .from("fun_tokens")
      .select("id")
      .eq("mint_address", mintAddress)
      .maybeSingle();

    if (existing?.id) {
      funTokenId = existing.id;
      await supabase
        .from("fun_tokens")
        .update({
          agent_id: agent.id,
          agent_fee_share_bps: 8000,
        })
        .eq("id", funTokenId);
    } else {
      const { data: inserted } = await supabase
        .from("fun_tokens")
        .insert({
          name: parsed.name,
          ticker: parsed.symbol,
          description: parsed.description || null,
          image_url: parsed.image || null,
          creator_wallet: parsed.wallet,
          mint_address: mintAddress,
          dbc_pool_address: dbcPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: parsed.website || null,
          twitter_url: parsed.twitter || null,
          telegram_url: parsed.telegram || null,
          discord_url: parsed.discord || null,
          agent_id: agent.id,
          agent_fee_share_bps: 8000,
          chain: "solana",
        })
        .select("id")
        .single();

      funTokenId = inserted?.id || null;
    }

    // Create agent_tokens link
    if (funTokenId) {
      await supabase.from("agent_tokens").insert({
        agent_id: agent.id,
        fun_token_id: funTokenId,
        source_platform: platform,
        source_post_id: postId,
        source_post_url: postUrl,
      });

      // === AUTO-CREATE SUBTUNA COMMUNITY ===
      console.log(`[agent-process-post] Creating SubTuna community for ${parsed.symbol}`);
      
      const { data: subtuna, error: subtunaError } = await supabase
        .from("subtuna")
        .insert({
          fun_token_id: funTokenId,
          agent_id: agent.id,
          name: `t/${parsed.symbol.toUpperCase()}`,
          description: parsed.description || `Welcome to the official community for $${parsed.symbol}!`,
          icon_url: parsed.image || null,
        })
        .select("id")
        .single();

      if (subtuna && !subtunaError) {
        // Create welcome post from agent
        await supabase.from("subtuna_posts").insert({
          subtuna_id: subtuna.id,
          author_agent_id: agent.id,
          title: `Welcome to t/${parsed.symbol}! 🎉`,
          content: `**${parsed.name}** has officially launched!\n\nThis is the official community for $${parsed.symbol} holders and enthusiasts. Join the discussion, share your thoughts, and connect with fellow community members.\n\n${parsed.website ? `🌐 Website: ${parsed.website}` : ""}\n${parsed.twitter ? `🐦 Twitter: ${parsed.twitter}` : ""}\n${parsed.telegram ? `💬 Telegram: ${parsed.telegram}` : ""}\n\n**Trade now:** [tuna.fun/launchpad/${mintAddress}](https://tuna.fun/launchpad/${mintAddress})`,
          post_type: "text",
          is_agent_post: true,
          is_pinned: true,
        });

        console.log(`[agent-process-post] ✅ SubTuna community created: t/${parsed.symbol}`);
      } else if (subtunaError) {
        console.error(`[agent-process-post] SubTuna creation failed:`, subtunaError.message);
      }
    }

    // === TRIGGER STYLE LEARNING FOR TWITTER LAUNCHES ===
    if (platform === "twitter" && postAuthor) {
      console.log(`[agent-process-post] Triggering style learning for @${postAuthor}`);
      
      // Fire-and-forget style learning (don't block token creation)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      fetch(`${supabaseUrl}/functions/v1/agent-learn-style`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          agentId: agent.id,
          twitterUsername: postAuthor,
        }),
      }).catch((err) => {
        console.error("[agent-process-post] Style learning trigger failed:", err);
      });
    }

    // Update agent stats
    await supabase
      .from("agents")
      .update({
        total_tokens_launched: (agentData?.total_tokens_launched || 0) + 1,
        launches_today: (agentData?.launches_today || 0) + 1,
        last_launch_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    // Mark social post as completed
    await supabase
      .from("agent_social_posts")
      .update({
        status: "completed",
        fun_token_id: funTokenId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", socialPostId);

    const tradeUrl = `https://tuna.fun/launchpad/${mintAddress}`;

    console.log(
      `[agent-process-post] ✅ Token launched: ${mintAddress} from ${platform} post`
    );

    return {
      success: true,
      mintAddress,
      tradeUrl,
      socialPostId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[agent-process-post] Launch failed:`, errorMessage);

    // Mark as failed
    await supabase
      .from("agent_social_posts")
      .update({
        status: "failed",
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("id", socialPostId);

    return {
      success: false,
      error: errorMessage,
      socialPostId,
    };
  }
}

// HTTP handler for direct calls (testing/debugging)
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

    const body = await req.json();
    const { platform, postId, postUrl, postAuthor, postAuthorId, content } = body;

    if (!platform || !postId || !content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: platform, postId, content",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      "https://tunalaunch.vercel.app";

    const supabase = createClient(supabaseUrl, supabaseKey);

    const result = await processLaunchPost(
      supabase,
      platform,
      postId,
      postUrl || null,
      postAuthor || null,
      postAuthorId || null,
      content,
      meteoraApiUrl
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 201 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[agent-process-post] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
