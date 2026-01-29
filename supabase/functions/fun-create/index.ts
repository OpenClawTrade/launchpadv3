import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== SERVER-SIDE RATE LIMIT ENFORCEMENT =====
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

    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, creatorWallet } = await req.json();

    // Validate required fields
    if (!name || !ticker || !creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, creatorWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block spam/exploit names
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

    console.log("[fun-create] 🚀 Starting token creation:", { name, ticker, creatorWallet, clientIP });

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

    // Create job in database
    const { data: jobId, error: jobError } = await supabase.rpc("backend_create_token_job", {
      p_name: name.slice(0, 50),
      p_ticker: ticker.toUpperCase().slice(0, 10),
      p_creator_wallet: creatorWallet,
      p_description: description?.slice(0, 500) || null,
      p_image_url: storedImageUrl || null,
      p_website_url: websiteUrl || null,
      p_twitter_url: twitterUrl || null,
      p_client_ip: clientIP,
    });

    if (jobError || !jobId) {
      console.error("[fun-create] ❌ Job creation failed:", jobError);
      throw new Error("Failed to create token job");
    }

    console.log("[fun-create] ✅ Job created:", jobId);

    // Record rate limit entry (ignore errors)
    try {
      await supabase.from("launch_rate_limits").insert({
        ip_address: clientIP,
        token_id: null,
      });
    } catch (rlErr) {
      console.warn("[fun-create] ⚠️ Failed to record rate limit:", rlErr);
    }

    // Get Vercel API URL
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) {
      throw new Error("METEORA_API_URL not configured - cannot create on-chain pool");
    }

    // Set job to processing
    await supabase.from("fun_token_jobs").update({ status: "processing" }).eq("id", jobId);

    console.log("[fun-create] 🔥 Firing async call to Vercel API (fire-and-forget)...");

    // FIRE-AND-FORGET: Don't await this - Vercel will call back when done
    // This is necessary because Vercel Hobby plan has 10s timeout but on-chain ops take 20-40s
    fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description?.slice(0, 500) || `${name} - A fun meme coin!`,
        imageUrl: storedImageUrl,
        websiteUrl: websiteUrl || null,
        twitterUrl: twitterUrl || null,
        serverSideSign: true,
        feeRecipientWallet: creatorWallet,
        callbackUrl: `${supabaseUrl}/functions/v1/fun-create-callback`,
      }),
    }).catch(err => {
      console.error("[fun-create] ⚠️ Fire-and-forget request failed:", err);
    });

    // Return immediately with job ID - frontend will poll for status
    console.log("[fun-create] ✅ Returning job ID for polling:", jobId);
    
    return new Response(
      JSON.stringify({
        success: true,
        async: true,
        jobId,
        message: "Token creation started. Waiting for on-chain confirmation...",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[fun-create] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
