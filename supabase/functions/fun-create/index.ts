import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v1.2.0";
const DEPLOYED_AT = new Date().toISOString();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  console.log(`[fun-create][${VERSION}] Request received`, { clientIP, deployed: DEPLOYED_AT, elapsed: 0 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit check
    const MAX_LAUNCHES_PER_HOUR = 2;
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
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
      
      console.log(`[fun-create][${VERSION}] Rate limit exceeded`, { clientIP, elapsed: Date.now() - startTime });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Rate limited. Wait ${Math.ceil(waitSeconds / 60)} minutes.`,
          rateLimited: true,
          waitSeconds: Math.max(0, waitSeconds)
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fun-create][${VERSION}] Rate limit check passed`, { elapsed: Date.now() - startTime });

    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, creatorWallet } = await req.json();

    if (!name || !ticker || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, creatorWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isBlockedName(name) || isBlockedName(ticker) || isBlockedName(description || "")) {
      console.log("[fun-create] Blocked spam token:", { name, ticker });
      return new Response(
        JSON.stringify({ success: false, error: "Token name or ticker contains blocked content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creatorWallet)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Solana wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fun-create][${VERSION}] Validated inputs`, { name, ticker, elapsed: Date.now() - startTime });

    // Upload base64 image if provided
    let storedImageUrl = imageUrl;
    if (imageUrl?.startsWith("data:image")) {
      console.log(`[fun-create][${VERSION}] Starting image upload...`, { elapsed: Date.now() - startTime });
      try {
        const base64Data = imageUrl.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);
          storedImageUrl = publicUrl;
          console.log(`[fun-create][${VERSION}] Image uploaded`, { url: storedImageUrl, elapsed: Date.now() - startTime });
        } else {
          console.log(`[fun-create][${VERSION}] Image upload failed`, { error: uploadError.message, elapsed: Date.now() - startTime });
        }
      } catch (uploadErr) {
        console.error(`[fun-create][${VERSION}] Image upload error`, { error: uploadErr, elapsed: Date.now() - startTime });
      }
    }

    // Record rate limit (fire-and-forget)
    supabase.from("launch_rate_limits").insert({ ip_address: clientIP, token_id: null }).then(() => {});

    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) {
      throw new Error("METEORA_API_URL not configured");
    }

    console.log(`[fun-create][${VERSION}] Calling Vercel API...`, { url: `${meteoraApiUrl}/api/pool/create-fun`, elapsed: Date.now() - startTime });

    // Call Vercel API synchronously - this does all the work
    const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description?.slice(0, 500) || `${name} - A fun meme coin!`,
        imageUrl: storedImageUrl,
        websiteUrl: websiteUrl || null,
        twitterUrl: twitterUrl || null,
        serverSideSign: true,
        feeRecipientWallet: creatorWallet,
        useVanityAddress: false, // DISABLED - vanity pool is empty
      }),
    });

    const vercelElapsed = Date.now() - startTime;
    const result = await vercelResponse.json();
    console.log(`[fun-create][${VERSION}] Vercel response received`, { 
      success: result.success, 
      mintAddress: result.mintAddress, 
      status: vercelResponse.status,
      elapsed: vercelElapsed 
    });

    if (!vercelResponse.ok || !result.success) {
      console.error(`[fun-create][${VERSION}] Vercel error`, { error: result.error, elapsed: Date.now() - startTime });
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || `Token creation failed (${vercelResponse.status})`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fun-create][${VERSION}] SUCCESS`, { mintAddress: result.mintAddress, totalElapsed: Date.now() - startTime });

    // Return Vercel's response directly - it has all the data we need
    return new Response(
      JSON.stringify({
        success: true,
        tokenId: result.tokenId,
        mintAddress: result.mintAddress,
        dbcPoolAddress: result.dbcPoolAddress,
        solscanUrl: `https://solscan.io/token/${result.mintAddress}`,
        tradeUrl: `/token/${result.tokenId || result.mintAddress}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error(`[fun-create][${VERSION}] Fatal error`, { error: error instanceof Error ? error.message : error, elapsed: Date.now() - startTime });
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
