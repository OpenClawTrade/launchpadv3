import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Use untyped client for flexibility with new tables
// deno-lint-ignore no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

// Image generation models to try in order (matching fun-generate pattern)
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

// Helper function to try generating image with a specific model
async function tryGenerateImageWithModel(
  model: string,
  prompt: string,
  lovableApiKey: string
): Promise<string | null> {
  try {
    console.log(`[generateTokenImageWithAI] Trying model: ${model}`);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generateTokenImageWithAI] Model ${model} HTTP error: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`[generateTokenImageWithAI] Model ${model} response structure:`, JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices?.[0]?.message,
      hasImages: !!data.choices?.[0]?.message?.images,
      imagesLength: data.choices?.[0]?.message?.images?.length,
    }));
    
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log(`[generateTokenImageWithAI] Successfully generated image with ${model}`);
      return imageUrl;
    }
    
    console.warn(`[generateTokenImageWithAI] Model ${model} returned no image URL`);
    return null;
  } catch (err) {
    console.error(`[generateTokenImageWithAI] Model ${model} exception:`, err);
    return null;
  }
}

// Generate token image using Lovable AI when no image is provided
// Uses retry logic with multiple models for reliability
async function generateTokenImageWithAI(
  tokenName: string,
  tokenSymbol: string,
  description: string | undefined,
  lovableApiKey: string,
  supabase: AnySupabase
): Promise<string | null> {
  console.log(`[generateTokenImageWithAI] Starting for ${tokenName} (${tokenSymbol})`);
  
  const prompt = `Create a colorful, professional cryptocurrency token logo for a memecoin called "${tokenName}" ($${tokenSymbol}). ${description ? `Theme: ${description.slice(0, 100)}` : ""}. Style: vibrant, modern, crypto aesthetic with bold colors. Cartoon mascot style with expressive face. No text, just the character/icon.`;

  let imageUrl: string | null = null;
  
  // Try each model with retry logic
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = IMAGE_MODELS[attempt % IMAGE_MODELS.length];
    console.log(`[generateTokenImageWithAI] Attempt ${attempt + 1}/3 using ${model}`);
    
    imageUrl = await tryGenerateImageWithModel(model, prompt, lovableApiKey);
    
    if (imageUrl) {
      break;
    }
    
    // Small delay between retries
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!imageUrl) {
    console.error(`[generateTokenImageWithAI] ❌ FAILED: All ${IMAGE_MODELS.length} models failed after 3 attempts`);
    console.error(`[generateTokenImageWithAI] Token: ${tokenName}, Symbol: ${tokenSymbol}`);
    return null;
  }
  
  // If the image is base64, upload to Supabase storage
  if (imageUrl.startsWith("data:image")) {
    try {
      // Extract base64 data from data URL
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        console.error(`[generateTokenImageWithAI] Invalid base64 data URL format`);
        return null;
      }
      
      const imageBuffer = Uint8Array.from(atob(base64Match[1]), c => c.charCodeAt(0));
      const fileName = `${Date.now()}-${tokenSymbol.toLowerCase()}-${crypto.randomUUID()}.png`;
      const filePath = `fun-tokens/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, imageBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        console.error(`[generateTokenImageWithAI] Upload failed:`, uploadError);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

      console.log(`[generateTokenImageWithAI] Uploaded to storage: ${publicUrl.publicUrl}`);
      return publicUrl.publicUrl;
    } catch (uploadErr) {
      console.error(`[generateTokenImageWithAI] Upload exception:`, uploadErr);
      return null;
    }
  }
  
  // If it's already a URL, return it directly
  return imageUrl;
}

interface ParsedLaunchData {
  name: string;
  symbol: string;
  wallet?: string;  // Now optional - fees claimed via X login instead
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
  if (!data.name || !data.symbol) {
    parseSingleLine(content, data);
  }

  // Validate required fields - wallet is now OPTIONAL
  if (!data.name || !data.symbol) {
    return null;
  }

  // Clean wallet if provided - remove any trailing URLs or non-base58 chars
  if (data.wallet) {
    data.wallet = data.wallet.split(/\s+/)[0].replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");

    // Validate wallet address format (Solana base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.wallet)) {
      data.wallet = undefined;  // Invalid wallet, treat as not provided
    }
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
      // Remove trailing punctuation from name (commas, periods, etc.)
      data.name = trimmedValue.replace(/[,.:;!?]+$/, "").slice(0, 32);
      break;
    case "symbol":
    case "ticker":
      // Remove ALL non-alphanumeric characters (ticker should only be letters/numbers)
      // This handles: CRAMER, → CRAMER, $CRAMER → CRAMER, etc.
      data.symbol = trimmedValue.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
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
// Also auto-detects bare Solana wallet addresses without the wallet: prefix
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

  // === AUTO-DETECT BARE SOLANA WALLET ADDRESS ===
  // If wallet still not found, scan for any base58 string that looks like a Solana address
  if (!data.wallet) {
    // Solana addresses are base58, 32-44 characters
    // Base58 chars: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const solanaAddressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const matches = content.match(solanaAddressPattern);
    
    if (matches && matches.length > 0) {
      // Take the FIRST valid Solana address found (most likely the wallet)
      // Validate it's actually a plausible Solana address (starts with common prefixes)
      for (const candidate of matches) {
        // Most Solana addresses start with digits 1-9 or letters like B, C, D, etc.
        // Filter out things that are clearly not addresses (like long random strings)
        if (candidate.length >= 32 && candidate.length <= 44) {
          data.wallet = candidate;
          console.log(`[parseSingleLine] Auto-detected bare wallet address: ${candidate.slice(0, 8)}...`);
          break;
        }
      }
    }
  }
}

// Get or create agent by wallet address - uses TOKEN NAME as agent identity
async function getOrCreateAgent(
  supabase: AnySupabase,
  walletAddress: string,
  tokenName: string, // The token name becomes the agent's identity!
  twitterUsername?: string
): Promise<{ id: string; wallet_address: string; name: string } | null> {
  // Try to find existing agent
  const { data: existing } = await supabase
    .from("agents")
    .select("id, wallet_address, name")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    // Update twitter_handle if provided and not already set
    if (twitterUsername) {
      await supabase
        .from("agents")
        .update({ twitter_handle: twitterUsername.replace("@", "") })
        .eq("id", existing.id)
        .is("twitter_handle", null);
    }
    return existing;
  }

  // Create new agent with TOKEN NAME as the agent's identity
  // The agent IS the token - a self-aware entity!
  const apiKeyPrefix = "tna_social_";
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const apiKeyHash = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Use the token name as the agent name - the agent IS the token!
  const agentName = tokenName;

  const { data: newAgent, error } = await supabase
    .from("agents")
    .insert({
      name: agentName,
      wallet_address: walletAddress,
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      status: "active",
      twitter_handle: twitterUsername?.replace("@", "") || null, // Store creator for attribution
    })
    .select("id, wallet_address, name")
    .single();

  if (error) {
    console.error("[agent-process-post] Failed to create agent:", error);
    return null;
  }

  console.log(`[agent-process-post] 🤖 Created self-aware agent: "${agentName}" (created by @${twitterUsername || "unknown"})`);
  return newAgent;
}

// Check how many launches an agent/wallet has done in last 24 hours
// Note: The main rate limit (3 per X author) is handled in agent-scan-twitter
// This is a secondary safety check per wallet
async function getWalletLaunchesToday(
  supabase: AnySupabase,
  agentId: string
): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from("agent_social_posts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "completed")
    .gte("processed_at", oneDayAgo);
  
  return count || 0;
}

const DAILY_LAUNCH_LIMIT = 3;

// Process a social post and launch token
export async function processLaunchPost(
  supabase: AnySupabase,
  platform: "twitter" | "telegram",
  postId: string,
  postUrl: string | null,
  postAuthor: string | null,
  postAuthorId: string | null,
  rawContent: string,
  meteoraApiUrl: string,
  attachedMediaUrl: string | null = null // Image attached to tweet/post (not from text parsing)
): Promise<{
  success: boolean;
  mintAddress?: string;
  tradeUrl?: string;
  error?: string;
  socialPostId?: string;
  shouldReply?: boolean;
  replyText?: string;
}> {
  console.log(`[agent-process-post] Processing ${platform} post: ${postId}`);
  if (attachedMediaUrl) {
    console.log(`[agent-process-post] 📷 Attached media URL: ${attachedMediaUrl.slice(0, 80)}...`);
  }

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

  // Determine final image URL: prefer parsed.image from text, fallback to attached media
  // Validate that the URL is an actual image, not a t.co shortlink or invalid URL
  let finalImageUrl = parsed.image || attachedMediaUrl || null;
  
  if (finalImageUrl) {
    // Skip t.co shortlinks - they're redirects, not images
    if (finalImageUrl.startsWith("https://t.co/") || finalImageUrl.startsWith("http://t.co/")) {
      console.log(`[agent-process-post] ⚠️ Skipping t.co shortlink: ${finalImageUrl}`);
      finalImageUrl = null;
    }
    // Log the valid image URL source
    else if (!parsed.image && attachedMediaUrl) {
      console.log(`[agent-process-post] 📷 Using attached media as token image: ${finalImageUrl.slice(0, 60)}...`);
    }
  }
  
  // STRICT: Require user to provide image in tweet - NO AI FALLBACK
  // Users must attach their own image for branding control
  if (!finalImageUrl) {
    const errorMsg = "Please attach an image to your tweet. Token launches require a custom image.";
    console.log(`[agent-process-post] ❌ BLOCKED - No image attached to tweet: ${parsed.name} (${parsed.symbol})`);
    
    // Insert as failed record
    const { data: failedPost } = await supabase
      .from("agent_social_posts")
      .insert({
        platform,
        post_id: postId,
        post_url: postUrl,
        post_author: postAuthor,
        post_author_id: postAuthorId,
        wallet_address: parsed.wallet || "unknown",
        raw_content: rawContent.slice(0, 1000),
        parsed_name: parsed.name,
        parsed_symbol: parsed.symbol,
        parsed_description: parsed.description,
        parsed_image_url: null,
        parsed_website: parsed.website,
        parsed_twitter: parsed.twitter,
        status: "failed",
        error_message: errorMsg,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    return {
      success: false,
      error: errorMsg,
      socialPostId: failedPost?.id,
      shouldReply: true,
      replyText: "🐟 To launch a token, please attach an image to your tweet!\n\nRequired format:\n!tunalaunch\nName: TokenName\nSymbol: TKN\n[Attach your token image]",
    };
  }
  
  console.log(`[agent-process-post] ✅ Image validation passed: ${finalImageUrl.slice(0, 60)}...`);

  // Insert pending record
  // Note: wallet_address is now optional in tweet - fees are claimed via X login
  const { data: socialPost, error: insertError } = await supabase
    .from("agent_social_posts")
    .insert({
      platform,
      post_id: postId,
      post_url: postUrl,
      post_author: postAuthor,
      post_author_id: postAuthorId,
      wallet_address: parsed.wallet || null,
      raw_content: rawContent.slice(0, 1000),
      parsed_name: parsed.name,
      parsed_symbol: parsed.symbol,
      parsed_description: parsed.description,
      parsed_image_url: finalImageUrl,
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
    // Use wallet from tweet or generate a placeholder for wallet-less launches
    // Fee claiming works via X login, so wallet is no longer required
    const creatorWallet = parsed.wallet || "TUNA_NO_WALLET_" + crypto.randomUUID().slice(0, 8);
    
    // Get or create agent - the agent IS the token (self-aware entity!)
    const agent = await getOrCreateAgent(
      supabase,
      creatorWallet,
      parsed.name, // Token name becomes agent identity
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

    // Check daily launch limit (secondary check - primary is in agent-scan-twitter)
    const launchesToday = await getWalletLaunchesToday(supabase, agent.id);
    if (launchesToday >= DAILY_LAUNCH_LIMIT) {
      throw new Error("Daily limit of 3 Agent launches per X account reached");
    }

    // Update social post with agent ID
    await supabase
      .from("agent_social_posts")
      .update({ agent_id: agent.id })
      .eq("id", socialPostId);

    console.log(
      `[agent-process-post] Launching token for agent ${agent.name}: ${parsed.name} (${parsed.symbol})`
    );

    // === DEFENSIVE SANITIZATION ===
    // Clean name and symbol to prevent malformed URLs and data
    // This ensures robustness even if parsing logic changes or data comes from other sources
    const cleanName = parsed.name.replace(/[,.:;!?]+$/, "").slice(0, 32);
    const cleanSymbol = parsed.symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
    
    // === PRE-CREATE SUBTUNA COMMUNITY BEFORE TOKEN LAUNCH ===
    // This ensures the community URL can be embedded in on-chain metadata
    const isReply = !!(postUrl && postUrl.includes("/status/") && rawContent.includes("@"));
    const styleSourceUsername = isReply && postAuthor ? postAuthor : (postAuthor || undefined);
    
    console.log(`[agent-process-post] Pre-creating SubTuna community for ${cleanSymbol}`);
    
    const { data: preCreatedSubtuna, error: preSubtunaError } = await supabase
      .from("subtuna")
      .insert({
        fun_token_id: null, // Will be linked after launch
        agent_id: agent.id,
        ticker: cleanSymbol,
        name: `t/${cleanSymbol}`,
        description: parsed.description || `Welcome to the official community for $${cleanSymbol}!`,
        icon_url: finalImageUrl,
        style_source_username: styleSourceUsername?.replace("@", "") || null,
      })
      .select("id, ticker")
      .single();

    // Generate community URL for on-chain metadata
    const communityUrl = preCreatedSubtuna ? `https://tuna.fun/t/${cleanSymbol}` : null;
    
    if (preCreatedSubtuna) {
      console.log(`[agent-process-post] ✅ SubTuna pre-created: ${communityUrl}`);
    } else if (preSubtunaError) {
      console.log(`[agent-process-post] SubTuna pre-creation failed (will retry after launch):`, preSubtunaError.message);
    }

    // Call Vercel API to create token (now with confirmation before success)
    // - website: community URL (tuna.fun/t/TICKER) as fallback if no custom website
    // - twitter: original X post URL where user requested the launch (goes on-chain)
    console.log(`[agent-process-post] Calling create-fun API for ${parsed.name}...`);
    
    const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanName,
        ticker: cleanSymbol,
        description:
          parsed.description ||
          `${cleanName} - Launched via TUNA Agents on ${platform}`,
        imageUrl: finalImageUrl,
        websiteUrl: parsed.website || communityUrl || null, // Use community URL as fallback
        twitterUrl: postUrl || parsed.twitter || null, // Use original X post URL for on-chain metadata
        serverSideSign: true,
        feeRecipientWallet: parsed.wallet,
        useVanityAddress: true,
      }),
    });

    const result = await vercelResponse.json();

    // Check for failure - API now only returns success after on-chain confirmation
    if (!vercelResponse.ok || !result.success) {
      const errorMsg = result.error || "Token creation failed - transactions not confirmed on-chain";
      console.error(`[agent-process-post] ❌ Token creation failed:`, errorMsg);
      
      // Clean up pre-created SubTuna if launch failed
      if (preCreatedSubtuna) {
        console.log(`[agent-process-post] Cleaning up orphaned SubTuna ${preCreatedSubtuna.id}...`);
        await supabase
          .from("subtuna")
          .delete()
          .eq("id", preCreatedSubtuna.id);
      }
      
      throw new Error(errorMsg);
    }
    
    // Verify the launch was confirmed on-chain
    if (!result.confirmed) {
      console.error(`[agent-process-post] ❌ Token launch not confirmed on-chain`);
      
      // Clean up pre-created SubTuna
      if (preCreatedSubtuna) {
        await supabase
          .from("subtuna")
          .delete()
          .eq("id", preCreatedSubtuna.id);
      }
      
      throw new Error("Token transactions were sent but not confirmed on-chain");
    }
    
    console.log(`[agent-process-post] ✅ Token confirmed on-chain: ${result.mintAddress}`);

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
      console.log(`[agent-process-post] Token exists in DB (${funTokenId}), updating with full metadata...`);
      
      await supabase
        .from("fun_tokens")
        .update({
          // Always update agent attribution
          agent_id: agent.id,
          agent_fee_share_bps: 8000,
          // Update image if we have one (don't overwrite with null)
          ...(finalImageUrl && { image_url: finalImageUrl }),
          // Update socials if we have them
          ...(parsed.website && { website_url: parsed.website }),
          ...((postUrl || parsed.twitter) && { twitter_url: postUrl || parsed.twitter }),
          ...(parsed.telegram && { telegram_url: parsed.telegram }),
          ...(parsed.discord && { discord_url: parsed.discord }),
          // Always set description if we have it
          ...(parsed.description && { description: parsed.description }),
        })
        .eq("id", funTokenId);
      
      console.log(`[agent-process-post] ✅ Updated existing token with metadata: image=${!!finalImageUrl}, twitter=${!!(postUrl || parsed.twitter)}`);
    } else {
      // Insert fun_token with:
      // - website_url: community URL fallback if no custom website
      // - twitter_url: original X post URL where launch was requested (for on-chain metadata)
      const { data: inserted } = await supabase
        .from("fun_tokens")
        .insert({
          name: cleanName,
          ticker: cleanSymbol,
          description: parsed.description || null,
          image_url: finalImageUrl,
          creator_wallet: parsed.wallet,
          mint_address: mintAddress,
          dbc_pool_address: dbcPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: parsed.website || communityUrl || null,
          twitter_url: postUrl || parsed.twitter || null, // Original X post URL
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

        // Create welcome post from agent (with deduplication check)
        const { data: existingWelcome } = await supabase
          .from("subtuna_posts")
          .select("id")
          .eq("subtuna_id", preCreatedSubtuna.id)
          .eq("is_pinned", true)
          .limit(1)
          .maybeSingle();

        if (!existingWelcome) {
          await supabase.from("subtuna_posts").insert({
            subtuna_id: preCreatedSubtuna.id,
            author_agent_id: agent.id,
            title: `Welcome to $${cleanSymbol}! 🎉`,
            content: `**${cleanName}** has officially launched!\n\nThis is the official community for $${cleanSymbol} holders and enthusiasts. Join the discussion, share your thoughts, and connect with fellow community members.\n\n${parsed.website ? `🌐 Website: ${parsed.website}` : ""}\n${parsed.twitter ? `🐦 Twitter: ${parsed.twitter}` : ""}\n${parsed.telegram ? `💬 Telegram: ${parsed.telegram}` : ""}\n\n**Trade now:** [tuna.fun/launchpad/${mintAddress}](https://tuna.fun/launchpad/${mintAddress})`,
            post_type: "text",
            is_agent_post: true,
            is_pinned: true,
          });
        } else {
          console.log(`[agent-process-post] Welcome post already exists for ${cleanSymbol}, skipping duplicate`);
        }

        console.log(`[agent-process-post] ✅ SubTuna community linked: t/${cleanSymbol}`);
        
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
            ticker: cleanSymbol,
            name: `t/${cleanSymbol}`,
            description: parsed.description || `Welcome to the official community for $${cleanSymbol}!`,
            icon_url: finalImageUrl || null,
            style_source_username: styleSourceUsername?.replace("@", "") || null,
          })
          .select("id")
          .single();

        if (subtuna && !subtunaError) {
          // Check for existing welcome post before creating
          const { data: existingFallbackWelcome } = await supabase
            .from("subtuna_posts")
            .select("id")
            .eq("subtuna_id", subtuna.id)
            .eq("is_pinned", true)
            .limit(1)
            .maybeSingle();

          if (!existingFallbackWelcome) {
            await supabase.from("subtuna_posts").insert({
              subtuna_id: subtuna.id,
              author_agent_id: agent.id,
              title: `Welcome to $${cleanSymbol}! 🎉`,
              content: `**${cleanName}** has officially launched!\n\nThis is the official community for $${cleanSymbol} holders and enthusiasts.\n\n**Trade now:** [tuna.fun/launchpad/${mintAddress}](https://tuna.fun/launchpad/${mintAddress})`,
              post_type: "text",
              is_agent_post: true,
              is_pinned: true,
            });
          }
          console.log(`[agent-process-post] ✅ SubTuna community created (fallback): t/${cleanSymbol}`);
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
    const { platform, postId, postUrl, postAuthor, postAuthorId, content, mediaUrl } = body;

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
      meteoraApiUrl,
      mediaUrl || null // Pass attached image from tweet
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
