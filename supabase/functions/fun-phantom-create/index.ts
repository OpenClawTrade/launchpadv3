import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// Default socials for all tokens
const DEFAULT_WEBSITE = "https://ai67x.fun";
const DEFAULT_TWITTER = "https://x.com/ai67x_fun";

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
    // Always respond to preflight with CORS headers (and no auth requirement)
    return new Response(null, { status: 204, headers: corsHeaders });
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
      
      console.log(`[fun-phantom-create] ❌ Rate limit exceeded for IP: ${clientIP} (${recentLaunches.length} launches)`);
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

    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, phantomWallet } = await req.json();

    // Validate required fields
    if (!name || !ticker || !phantomWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, phantomWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block spam/exploit names and tickers
    if (isBlockedName(name) || isBlockedName(ticker) || isBlockedName(description || "")) {
      console.log("[fun-phantom-create] ❌ Blocked spam token attempt:", { name, ticker });
      return new Response(
        JSON.stringify({ success: false, error: "Token name or ticker contains blocked content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Solana address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(phantomWallet)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Solana wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-phantom-create] 🚀 Creating Phantom-paid token:", { name, ticker, phantomWallet, clientIP });

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
          console.log("[fun-phantom-create] ✅ Image uploaded:", storedImageUrl);
        } else {
          console.error("[fun-phantom-create] ⚠️ Image upload error:", uploadError);
        }
      } catch (uploadErr) {
        console.error("[fun-phantom-create] ⚠️ Image processing error:", uploadErr);
      }
    }

    // Call Vercel API to create pool - but with Phantom wallet as fee payer
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    
    if (!meteoraApiUrl) {
      console.error("[fun-phantom-create] ❌ METEORA_API_URL not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "On-chain pool creation not configured. Please configure METEORA_API_URL." 
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-phantom-create] 📡 Calling Meteora API for Phantom launch:", `${meteoraApiUrl}/api/pool/create-phantom`);

    let mintAddress: string;
    let dbcPoolAddress: string | null = null;
    let unsignedTransactions: string[] = [];

    try {
      // Call the pool creation API - will return unsigned transactions for Phantom to sign
      const poolResponse = await fetch(`${meteoraApiUrl}/api/pool/create-phantom`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.slice(0, 32),
          ticker: ticker.toUpperCase().slice(0, 10),
          description: description?.slice(0, 500) || `${name} - A fun meme coin!`,
          imageUrl: storedImageUrl,
          websiteUrl: websiteUrl || DEFAULT_WEBSITE,
          twitterUrl: twitterUrl || DEFAULT_TWITTER,
          phantomWallet, // User's Phantom wallet as fee payer
          feeRecipientWallet: phantomWallet, // All fees go to Phantom wallet
        }),
      });

      if (!poolResponse.ok) {
        const errorText = await poolResponse.text();
        console.error("[fun-phantom-create] ❌ Pool API error:", poolResponse.status, errorText);
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
        console.error("[fun-phantom-create] ❌ Pool API returned invalid data:", poolData);
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
      unsignedTransactions = poolData.unsignedTransactions || [];
      
      console.log("[fun-phantom-create] ✅ Pool created with Phantom wallet:", { 
        mintAddress, 
        dbcPoolAddress,
        txCount: unsignedTransactions.length 
      });

    } catch (fetchError) {
      console.error("[fun-phantom-create] ❌ Pool API fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to connect to pool creation service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into fun_tokens with Phantom wallet as creator
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name: name.slice(0, 50),
        ticker: ticker.toUpperCase().slice(0, 5),
        description: description?.slice(0, 500) || null,
        image_url: storedImageUrl || null,
        creator_wallet: phantomWallet, // Phantom wallet receives fees
        mint_address: mintAddress,
        dbc_pool_address: dbcPoolAddress,
        status: "active",
        price_sol: 0.00000003,
        website_url: websiteUrl || DEFAULT_WEBSITE,
        twitter_url: twitterUrl || DEFAULT_TWITTER,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[fun-phantom-create] ❌ Insert error:", insertError);
      throw new Error("Failed to create token record");
    }

    console.log("[fun-phantom-create] ✅ Token created successfully:", {
      id: funToken.id,
      name: funToken.name,
      ticker: funToken.ticker,
      mintAddress,
      dbcPoolAddress,
      creatorWallet: phantomWallet,
    });

    // Record this launch for rate limiting
    try {
      await supabase.from("launch_rate_limits").insert({
        ip_address: clientIP,
        token_id: null,
      });
      console.log("[fun-phantom-create] 📊 Rate limit recorded for IP:", clientIP);
    } catch (rlErr) {
      console.warn("[fun-phantom-create] ⚠️ Failed to record rate limit:", rlErr);
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
        unsignedTransactions, // Return transactions for Phantom to sign
        onChainSuccess: true,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress || mintAddress}`,
        message: "🚀 Token launched with Phantom! 100% of trading fees go to your wallet.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[fun-phantom-create] ❌ Fatal error:", error);
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
