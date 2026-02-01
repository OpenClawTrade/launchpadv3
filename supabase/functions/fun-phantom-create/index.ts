import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// Default socials removed per memory - fields should be null when not provided
// const DEFAULT_WEBSITE = "https://buildtuna.com";
// const DEFAULT_TWITTER = "https://x.com/buildtuna";

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
    // Some browsers/extensions can be picky about 204 preflight responses.
    // Return 200 with explicit CORS headers to maximize compatibility.
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Access-Control-Max-Age": "86400",
      },
    });
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

    // Rate limiting removed per user request

    const body = await req.json();
    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, telegramUrl, discordUrl, phantomWallet, confirmed, mintAddress: confirmedMintAddress, dbcPoolAddress: confirmedPoolAddress, tradingFeeBps: rawFeeBps, feeMode } = body;
    
    // Validate and constrain trading fee to valid range (10-1000 bps = 0.1%-10%)
    const MIN_FEE_BPS = 10;
    const MAX_FEE_BPS = 1000;
    const DEFAULT_FEE_BPS = 200;
    const tradingFeeBps = Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, Math.round(Number(rawFeeBps) || DEFAULT_FEE_BPS)));
    console.log("[fun-phantom-create] Validated tradingFeeBps:", tradingFeeBps, "from raw:", rawFeeBps);

    // ===== PHASE 2: Record token after confirmation =====
    if (confirmed === true && confirmedMintAddress && confirmedPoolAddress) {
      console.log("[fun-phantom-create] 📝 Phase 2: Recording confirmed token...");
      
      // Upload base64 image if needed
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
          }
        } catch (uploadErr) {
          console.error("[fun-phantom-create] ⚠️ Image processing error:", uploadErr);
        }
      }

      // Validate fee mode
      const validFeeModes = ['creator', 'holder_rewards'];
      const tokenFeeMode = validFeeModes.includes(feeMode) ? feeMode : 'creator';

      // Insert into fun_tokens after confirmation
      const { data: funToken, error: insertError } = await supabase
        .from("fun_tokens")
        .insert({
          name: name.slice(0, 50),
          ticker: ticker.toUpperCase().slice(0, 5),
          description: description?.slice(0, 500) || null,
          image_url: storedImageUrl || null,
          creator_wallet: phantomWallet,
          mint_address: confirmedMintAddress,
          dbc_pool_address: confirmedPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: websiteUrl || null,
          twitter_url: twitterUrl || null,
          telegram_url: telegramUrl || null,
          discord_url: discordUrl || null,
          fee_mode: tokenFeeMode,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[fun-phantom-create] ❌ Insert error:", insertError);
        throw new Error("Failed to create token record");
      }

      // If holder_rewards mode, initialize the pool
      if (tokenFeeMode === 'holder_rewards') {
        await supabase.from("holder_reward_pool").insert({
          fun_token_id: funToken.id,
          accumulated_sol: 0,
        }).then(({ error }) => {
          if (error) console.warn("[fun-phantom-create] Failed to init holder pool:", error.message);
        });
      }

      console.log("[fun-phantom-create] ✅ Token recorded:", { id: funToken.id, name: funToken.name, feeMode: tokenFeeMode });
      
      return new Response(
        JSON.stringify({
          success: true,
          tokenId: funToken.id,
          recorded: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== PHASE 1: Prepare transactions (no DB insert) =====
    
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

    console.log("[fun-phantom-create] 🚀 Phase 1: Preparing Phantom transactions:", { name, ticker, phantomWallet, clientIP });

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

    // ===== EARLY METADATA STORE =====
    // Store pending metadata with the image/socials BEFORE on-chain tx so that
    // the token-metadata endpoint can serve it as soon as explorers fetch it.
    // Key will be set after we have the mintAddress from pool creation.

    // Call pool creation API (Vercel /api route).
    // IMPORTANT: If METEORA_API_URL points to an older deployment, Phantom launches can fail with
    // "URI too long" due to older metadata URI construction.
    // To make preview + current deployment consistent, fallback to the request Origin.
    const origin = req.headers.get("origin")?.replace(/\/$/, "") || "";
    const meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      origin;

    if (!meteoraApiUrl) {
      console.error("[fun-phantom-create] ❌ METEORA_API_URL not configured and no Origin header present");
      return new Response(
        JSON.stringify({
          success: false,
          error: "On-chain pool creation not configured. Please configure METEORA_API_URL.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      "[fun-phantom-create] 📡 Calling pool creation API for Phantom launch:",
      `${meteoraApiUrl}/api/pool/create-phantom`,
      { usedOriginFallback: !Deno.env.get("METEORA_API_URL") && !Deno.env.get("VITE_METEORA_API_URL") }
    );

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
          websiteUrl: websiteUrl || null,
          twitterUrl: twitterUrl || null,
          telegramUrl: telegramUrl || null,
          discordUrl: discordUrl || null,
          phantomWallet, // User's Phantom wallet as fee payer
          feeRecipientWallet: phantomWallet, // All fees go to Phantom wallet
          tradingFeeBps: tradingFeeBps || 200, // Default 2%, allow 0.1%-10%
          useVanityAddress: true, // Use pre-generated TNA vanity addresses from pool
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
      
      console.log("[fun-phantom-create] ✅ Transactions prepared (NOT recorded in DB yet):", { 
        mintAddress, 
        dbcPoolAddress,
        txCount: unsignedTransactions.length 
      });

      // ===== STORE PENDING METADATA =====
      // Insert into pending_token_metadata so the token-metadata endpoint
      // can serve image/socials as soon as explorers fetch the metadata URI.
      try {
        const { error: pendingErr } = await supabase
          .from("pending_token_metadata")
          .upsert({
            mint_address: mintAddress,
            name: name.slice(0, 50),
            ticker: ticker.toUpperCase().slice(0, 5),
            description: description?.slice(0, 500) || null,
            image_url: storedImageUrl || null,
            website_url: websiteUrl || null,
            twitter_url: twitterUrl || null,
            telegram_url: body.telegramUrl || null,
            discord_url: body.discordUrl || null,
            creator_wallet: phantomWallet,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min TTL
          }, { onConflict: "mint_address" });
        if (pendingErr) {
          console.warn("[fun-phantom-create] ⚠️ Failed to store pending metadata:", pendingErr.message);
        } else {
          console.log("[fun-phantom-create] 📝 Pending metadata stored for:", mintAddress);
        }
      } catch (pendingStoreErr) {
        console.warn("[fun-phantom-create] ⚠️ Pending metadata store error:", pendingStoreErr);
      }

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

    // NOTE: We do NOT insert into fun_tokens database here!
    // Token will only be recorded after Phantom confirms the transaction

    return new Response(
      JSON.stringify({
        success: true,
        // Return data needed for Phase 2 after confirmation
        name: name.slice(0, 50),
        ticker: ticker.toUpperCase().slice(0, 5),
        mintAddress,
        dbcPoolAddress,
        imageUrl: storedImageUrl,
        unsignedTransactions, // Return transactions for Phantom to sign
        onChainSuccess: false, // Not yet confirmed
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress || mintAddress}`,
        message: "🚀 Ready for Phantom signature. Token will be recorded after confirmation.",
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
