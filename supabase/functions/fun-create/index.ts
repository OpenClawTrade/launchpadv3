import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default socials removed per memory - fields should be null when not provided
// const DEFAULT_WEBSITE = "https://rift.fun";
// const DEFAULT_TWITTER = "https://x.com/rift_fun";

// Blocked patterns for spam/exploit names
const BLOCKED_PATTERNS = [
  /exploit/i,
  /hack/i,
  /0xh1ve/i,
  /fix\s*(ur|your)\s*site/i,
  /dm\s*@/i,
  /found\s*(an?|the)?\s*exploit/i,
  /vulnerability/i,
  /security\s*issue/i,
  /into\s*(ur|your)\s*db/i,
];

function isBlockedName(name: string): boolean {
  if (!name) return false;
  return BLOCKED_PATTERNS.some(pattern => pattern.test(name));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP from headers
  const clientIP = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  try {
    // Initialize Supabase client with service role FIRST for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== SERVER-SIDE RATE LIMIT ENFORCEMENT =====
    const MAX_LAUNCHES_PER_HOUR = 2;
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { data: recentLaunches, error: rlError } = await supabase
      .from("launch_rate_limits")
      .select("launched_at")
      .eq("ip_address", clientIP)
      .gte("launched_at", oneHourAgo);

    if (!rlError && recentLaunches && recentLaunches.length >= MAX_LAUNCHES_PER_HOUR) {
      const oldestLaunch = new Date(recentLaunches[0].launched_at);
      const expiresAt = new Date(oldestLaunch.getTime() + RATE_LIMIT_WINDOW_MS);
      const waitSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
      
      console.log(`[fun-create] ❌ Rate limit exceeded for IP: ${clientIP} (${recentLaunches.length} launches)`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `You've already launched ${recentLaunches.length} coins in the last 60 minutes. Please wait ${Math.ceil(waitSeconds / 60)} minutes.`,
          rateLimited: true,
          waitSeconds: Math.max(0, waitSeconds)
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ===== END RATE LIMIT ENFORCEMENT =====

    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, creatorWallet } = await req.json();

    // Validate required fields
    if (!name || !ticker || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, creatorWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block spam/exploit names and tickers
    if (isBlockedName(name) || isBlockedName(ticker) || isBlockedName(description || "")) {
      console.log("[fun-create] ❌ Blocked spam token attempt:", { name, ticker });
      return new Response(
        JSON.stringify({ success: false, error: "Token name or ticker contains blocked content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Solana address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creatorWallet)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Solana wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-create] 🚀 Creating token:", { name, ticker, creatorWallet, clientIP });

    // Upload base64 image to storage if provided
    let storedImageUrl = imageUrl;
    if (imageUrl?.startsWith("data:image")) {
      try {
        const base64Data = imageUrl.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);
          storedImageUrl = publicUrl;
          console.log("[fun-create] ✅ Image uploaded:", storedImageUrl);
        } else {
          console.error("[fun-create] ⚠️ Image upload error:", uploadError);
        }
      } catch (uploadErr) {
        console.error("[fun-create] ⚠️ Image processing error:", uploadErr);
      }
    }

    // Call Vercel API to create real on-chain pool with treasury wallet
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    
    if (!meteoraApiUrl) {
      console.error("[fun-create] ❌ METEORA_API_URL not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "On-chain pool creation not configured. Please configure METEORA_API_URL." 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get treasury wallet address from private key
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryPrivateKey) {
      console.error("[fun-create] ❌ TREASURY_PRIVATE_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Treasury wallet not configured. Please configure TREASURY_PRIVATE_KEY." 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-create] 📡 Calling Meteora API:", `${meteoraApiUrl}/api/pool/create-fun`);

    let mintAddress: string;
    let dbcPoolAddress: string | null = null;

    try {
      // Call the pool creation API with treasury as creator (server-side signing)
      const poolResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.slice(0, 32),
          ticker: ticker.toUpperCase().slice(0, 10),
          description: description?.slice(0, 500) || `${name} - A fun meme coin!`,
          imageUrl: storedImageUrl,
          websiteUrl: websiteUrl || null,
          twitterUrl: twitterUrl || null,
          serverSideSign: true,
          feeRecipientWallet: creatorWallet,
        }),
      });

      if (!poolResponse.ok) {
        const errorText = await poolResponse.text();
        console.error("[fun-create] ❌ Pool API error:", poolResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `On-chain pool creation failed: ${errorText}` 
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const poolData = await poolResponse.json();
      
      if (!poolData.success || !poolData.mintAddress) {
        console.error("[fun-create] ❌ Pool API returned invalid data:", poolData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: poolData.error || "On-chain pool creation returned invalid data" 
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      mintAddress = poolData.mintAddress;
      dbcPoolAddress = poolData.dbcPoolAddress || poolData.poolAddress;
      console.log("[fun-create] ✅ On-chain pool created:", { mintAddress, dbcPoolAddress });

    } catch (fetchError) {
      console.error("[fun-create] ❌ Pool API fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to connect to pool creation service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only insert into fun_tokens table if on-chain creation succeeded
    // Include social URLs so token-metadata can serve them
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name: name.slice(0, 50),
        ticker: ticker.toUpperCase().slice(0, 5),
        description: description?.slice(0, 500) || null,
        image_url: storedImageUrl || null,
        creator_wallet: creatorWallet,
        mint_address: mintAddress,
        dbc_pool_address: dbcPoolAddress,
        status: "active",
        price_sol: 0.00000003,
        website_url: websiteUrl || null,
        twitter_url: twitterUrl || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[fun-create] ❌ Insert error:", insertError);
      throw new Error("Failed to create token record");
    }

    console.log("[fun-create] ✅ Token created successfully:", {
      id: funToken.id,
      name: funToken.name,
      ticker: funToken.ticker,
      mintAddress,
      dbcPoolAddress,
      status: funToken.status,
    });

    // Record this launch for rate limiting (ignore errors)
    try {
      await supabase.from("launch_rate_limits").insert({
        ip_address: clientIP,
        token_id: null, // fun_tokens don't have tokens.id reference
      });
      console.log("[fun-create] 📊 Rate limit recorded for IP:", clientIP);
    } catch (rlErr) {
      console.warn("[fun-create] ⚠️ Failed to record rate limit:", rlErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: funToken.id,
        name: funToken.name,
        ticker: funToken.ticker,
        mintAddress,
        dbcPoolAddress,
        imageUrl: storedImageUrl,
        onChainSuccess: true,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress || mintAddress}`,
        message: "🚀 Token launched successfully! You'll receive 50% of trading fees every few minutes.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[fun-create] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
