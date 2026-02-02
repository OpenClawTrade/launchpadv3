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
// Supports both multi-line format (key: value on each line) and single-line format
export function parseLaunchPost(content: string): ParsedLaunchData | null {
  // Check for the trigger command
  if (!content.toLowerCase().includes("!tunalaunch")) {
    return null;
  }

  const data: Partial<ParsedLaunchData> = {};

  // First try multi-line parsing
  const lines = content.split("\n").map((line) => line.trim());

  for (const line of lines) {
    // Match key: value patterns on separate lines
    const match = line.match(/^(\w+)\s*[:=]\s*(.+)$/i);
    if (match) {
      const [, key, value] = match;
      assignParsedField(data, key, value);
    }
  }

  // If multi-line parsing didn't find required fields, try single-line parsing
  if (!data.name || !data.symbol || !data.wallet) {
    parseSingleLine(content, data);
  }

  // Validate required fields
  if (!data.name || !data.symbol || !data.wallet) {
    return null;
  }

  // Clean wallet - remove any trailing URLs or non-base58 chars
  data.wallet = data.wallet.split(/\s+/)[0].replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");

  // Validate wallet address format (Solana base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.wallet)) {
    return null;
  }

  return data as ParsedLaunchData;
}

// Helper to assign parsed field to data object
function assignParsedField(data: Partial<ParsedLaunchData>, key: string, value: string): void {
  const keyLower = key.toLowerCase();
  const trimmedValue = value.trim();

  switch (keyLower) {
    case "name":
    case "token":
      data.name = trimmedValue.slice(0, 32);
      break;
    case "symbol":
    case "ticker":
      data.symbol = trimmedValue.toUpperCase().slice(0, 10);
      break;
    case "wallet":
    case "address":
    case "creator":
      data.wallet = trimmedValue;
      break;
    case "description":
    case "desc":
      data.description = trimmedValue.slice(0, 500);
      break;
    case "image":
    case "logo":
    case "img":
      data.image = trimmedValue;
      break;
    case "website":
    case "site":
    case "web":
      data.website = trimmedValue;
      break;
    case "twitter":
    case "x":
      data.twitter = trimmedValue;
      break;
    case "telegram":
    case "tg":
      data.telegram = trimmedValue;
      break;
    case "discord":
      data.discord = trimmedValue;
      break;
  }
}

// Parse single-line format: "!tunalaunch name: X symbol: Y wallet: Z description: ..."
function parseSingleLine(content: string, data: Partial<ParsedLaunchData>): void {
  // Define field patterns - order matters, longer keys first
  const fieldKeys = [
    { pattern: /\bname\s*[:=]\s*/i, key: "name" },
    { pattern: /\btoken\s*[:=]\s*/i, key: "name" },
    { pattern: /\bsymbol\s*[:=]\s*/i, key: "symbol" },
    { pattern: /\bticker\s*[:=]\s*/i, key: "symbol" },
    { pattern: /\bwallet\s*[:=]\s*/i, key: "wallet" },
    { pattern: /\baddress\s*[:=]\s*/i, key: "wallet" },
    { pattern: /\bcreator\s*[:=]\s*/i, key: "wallet" },
    { pattern: /\bdescription\s*[:=]\s*/i, key: "description" },
    { pattern: /\bdesc\s*[:=]\s*/i, key: "description" },
    { pattern: /\bimage\s*[:=]\s*/i, key: "image" },
    { pattern: /\blogo\s*[:=]\s*/i, key: "image" },
    { pattern: /\bwebsite\s*[:=]\s*/i, key: "website" },
    { pattern: /\btwitter\s*[:=]\s*/i, key: "twitter" },
    { pattern: /\btelegram\s*[:=]\s*/i, key: "telegram" },
    { pattern: /\bdiscord\s*[:=]\s*/i, key: "discord" },
  ];

  // Find all field positions
  const positions: Array<{ key: string; start: number; matchEnd: number }> = [];
  
  for (const { pattern, key } of fieldKeys) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      // Check if we already have this key at an earlier position
      const existingIndex = positions.findIndex(p => p.key === key);
      if (existingIndex === -1) {
        positions.push({
          key,
          start: match.index,
          matchEnd: match.index + match[0].length,
        });
      }
    }
  }

  // Sort by position in the string
  positions.sort((a, b) => a.start - b.start);

  // Extract values - value is text from matchEnd until next field or end
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    
    // Value ends at next field start, or at end of content
    const valueEnd = next ? next.start : content.length;
    let value = content.slice(current.matchEnd, valueEnd).trim();
    
    // For wallet, stop at first whitespace or URL
    if (current.key === "wallet") {
      value = value.split(/[\s\n]/)[0];
    }
    
    // For description, capture until next known field
    if (current.key !== "description") {
      // Remove trailing URLs for non-description fields
      value = value.replace(/https?:\/\/\S+$/i, "").trim();
    }
    
    if (value) {
      assignParsedField(data, current.key, value);
    }
  }
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

    // === PRE-CREATE SUBTUNA COMMUNITY BEFORE TOKEN LAUNCH ===
    // This ensures the community URL can be embedded in on-chain metadata
    const tickerUpper = parsed.symbol.toUpperCase();
    const isReply = !!(postUrl && postUrl.includes("/status/") && rawContent.includes("@"));
    const styleSourceUsername = isReply && postAuthor ? postAuthor : (postAuthor || undefined);
    
    console.log(`[agent-process-post] Pre-creating SubTuna community for ${tickerUpper}`);
    
    const { data: preCreatedSubtuna, error: preSubtunaError } = await supabase
      .from("subtuna")
      .insert({
        fun_token_id: null, // Will be linked after launch
        agent_id: agent.id,
        ticker: tickerUpper,
        name: `t/${tickerUpper}`,
        description: parsed.description || `Welcome to the official community for $${tickerUpper}!`,
        icon_url: parsed.image || null,
        style_source_username: styleSourceUsername?.replace("@", "") || null,
      })
      .select("id, ticker")
      .single();

    // Generate community URL for on-chain metadata
    const communityUrl = preCreatedSubtuna ? `https://tuna.fun/t/${tickerUpper}` : null;
    
    if (preCreatedSubtuna) {
      console.log(`[agent-process-post] ✅ SubTuna pre-created: ${communityUrl}`);
    } else if (preSubtunaError) {
      console.log(`[agent-process-post] SubTuna pre-creation failed (will retry after launch):`, preSubtunaError.message);
    }

    // Call Vercel API to create token - use community URL as website if no custom website
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
        websiteUrl: parsed.website || communityUrl || null, // Use community URL as fallback
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

      // === LINK PRE-CREATED SUBTUNA TO TOKEN ===
      if (preCreatedSubtuna) {
        console.log(`[agent-process-post] Linking SubTuna ${preCreatedSubtuna.id} to token ${funTokenId}`);
        
        await supabase
          .from("subtuna")
          .update({ fun_token_id: funTokenId })
          .eq("id", preCreatedSubtuna.id);

        // Create welcome post from agent
        await supabase.from("subtuna_posts").insert({
          subtuna_id: preCreatedSubtuna.id,
          author_agent_id: agent.id,
          title: `Welcome to t/${tickerUpper}! 🎉`,
          content: `**${parsed.name}** has officially launched!\n\nThis is the official community for $${tickerUpper} holders and enthusiasts. Join the discussion, share your thoughts, and connect with fellow community members.\n\n${parsed.website ? `🌐 Website: ${parsed.website}` : ""}\n${parsed.twitter ? `🐦 Twitter: ${parsed.twitter}` : ""}\n${parsed.telegram ? `💬 Telegram: ${parsed.telegram}` : ""}\n\n**Trade now:** [tuna.fun/launchpad/${mintAddress}](https://tuna.fun/launchpad/${mintAddress})`,
          post_type: "text",
          is_agent_post: true,
          is_pinned: true,
        });

        console.log(`[agent-process-post] ✅ SubTuna community linked: t/${tickerUpper}`);
        
        // Trigger style learning
        if (platform === "twitter" && postAuthor) {
          console.log(`[agent-process-post] Triggering style learning for @${postAuthor} with subtuna ${preCreatedSubtuna.id}`);
          
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
              subtunaId: preCreatedSubtuna.id,
              isReply,
              parentAuthorUsername: isReply ? postAuthor : undefined,
            }),
          }).catch((err) => {
            console.error("[agent-process-post] Style learning trigger failed:", err);
          });
        }
      } else {
        // Fallback: SubTuna wasn't pre-created, create it now (legacy behavior)
        console.log(`[agent-process-post] Creating SubTuna community after launch (fallback)`);
        
        const { data: subtuna, error: subtunaError } = await supabase
          .from("subtuna")
          .insert({
            fun_token_id: funTokenId,
            agent_id: agent.id,
            ticker: tickerUpper,
            name: `t/${tickerUpper}`,
            description: parsed.description || `Welcome to the official community for $${tickerUpper}!`,
            icon_url: parsed.image || null,
            style_source_username: styleSourceUsername?.replace("@", "") || null,
          })
          .select("id")
          .single();

        if (subtuna && !subtunaError) {
          await supabase.from("subtuna_posts").insert({
            subtuna_id: subtuna.id,
            author_agent_id: agent.id,
            title: `Welcome to t/${tickerUpper}! 🎉`,
            content: `**${parsed.name}** has officially launched!\n\nThis is the official community for $${tickerUpper} holders and enthusiasts.\n\n**Trade now:** [tuna.fun/launchpad/${mintAddress}](https://tuna.fun/launchpad/${mintAddress})`,
            post_type: "text",
            is_agent_post: true,
            is_pinned: true,
          });
          console.log(`[agent-process-post] ✅ SubTuna community created (fallback): t/${tickerUpper}`);
        } else if (subtunaError) {
          console.error(`[agent-process-post] SubTuna creation failed:`, subtunaError.message);
        }
      }
    }

    // Style learning is now triggered in the subtuna creation block above
    // to ensure we have the subtuna ID for updating style_source_username

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
