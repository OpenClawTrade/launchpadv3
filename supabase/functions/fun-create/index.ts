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

function waitUntil(promise: Promise<unknown>) {
  // Supabase Edge Runtime supports EdgeRuntime.waitUntil for background tasks.
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(promise);
  } else {
    // Fallback: don't crash if waitUntil isn't available.
    promise.catch(() => undefined);
  }
}

async function runJobInBackground(args: {
  jobId: string;
  meteoraApiUrl: string;
  name: string;
  ticker: string;
  description?: string;
  storedImageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  creatorWallet: string;
}) {
  const {
    jobId,
    meteoraApiUrl,
    name,
    ticker,
    description,
    storedImageUrl,
    websiteUrl,
    twitterUrl,
    creatorWallet,
  } = args;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("[fun-create/bg] Calling Vercel API...", { jobId });

  const controller = new AbortController();
  // IMPORTANT:
  // We already return 202 immediately to the client and poll job status.
  // So we can afford a longer timeout here to avoid false negatives.
  // (If Vercel is slow/congested, a 15s abort will incorrectly mark jobs failed.)
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
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
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!vercelResponse.ok) {
      const errorText = await vercelResponse.text();
      console.error("[fun-create/bg] Vercel error:", vercelResponse.status, errorText);
      await supabase.rpc("backend_fail_token_job", {
        p_job_id: jobId,
        p_error_message: `API error (${vercelResponse.status}): ${errorText.slice(0, 160)}`,
      });
      return;
    }

    const result = await vercelResponse.json();
    console.log("[fun-create/bg] Vercel response received:", {
      jobId,
      success: result?.success,
      mintAddress: result?.mintAddress,
    });

    if (!result?.success) {
      await supabase.rpc("backend_fail_token_job", {
        p_job_id: jobId,
        p_error_message: result?.error || "Unknown error from Vercel",
      });
      return;
    }

    // Success - create fun_tokens record
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name: name.slice(0, 50),
        ticker: ticker.toUpperCase().slice(0, 5),
        description: description?.slice(0, 500) || null,
        image_url: storedImageUrl || null,
        creator_wallet: creatorWallet,
        mint_address: result.mintAddress,
        dbc_pool_address: result.dbcPoolAddress,
        status: "active",
        price_sol: 0.00000003,
        website_url: websiteUrl || null,
        twitter_url: twitterUrl || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[fun-create/bg] fun_tokens insert error:", insertError);
      await supabase.rpc("backend_fail_token_job", {
        p_job_id: jobId,
        p_error_message: "Failed to create token record: " + insertError.message,
      });
      return;
    }

    await supabase.rpc("backend_complete_token_job", {
      p_job_id: jobId,
      p_mint_address: result.mintAddress,
      p_dbc_pool_address: result.dbcPoolAddress,
      p_fun_token_id: funToken?.id || null,
    });

    console.log("[fun-create/bg] ✅ Job completed", { jobId, tokenId: funToken?.id });
  } catch (fetchError: unknown) {
    clearTimeout(timeoutId);
    const err = fetchError as Error;

    if (err?.name === "AbortError") {
      console.error("[fun-create/bg] Timeout waiting for Vercel", { jobId });
      await supabase.rpc("backend_fail_token_job", {
        p_job_id: jobId,
        p_error_message: "Token creation timed out. Please try again.",
      });
      return;
    }

    console.error("[fun-create/bg] Fatal fetch error:", err);
    await supabase.rpc("backend_fail_token_job", {
      p_job_id: jobId,
      p_error_message: err?.message || "Unknown fetch error",
    });
  }
}

serve(async (req) => {
  // CRITICAL: Always return CORS headers, even on error
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

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
      
      console.log(`[fun-create] Rate limit exceeded for IP: ${clientIP}`);
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

    console.log("[fun-create] Starting:", { name, ticker, clientIP });

    // Upload base64 image if provided
    let storedImageUrl = imageUrl;
    if (imageUrl?.startsWith("data:image")) {
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
          console.log("[fun-create] Image uploaded:", storedImageUrl);
        }
      } catch (uploadErr) {
        console.error("[fun-create] Image upload error:", uploadErr);
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
      console.error("[fun-create] Job creation failed:", jobError);
      throw new Error("Failed to create token job");
    }

    console.log("[fun-create] Job created:", jobId);

    // Record rate limit (ignore errors)
    try {
      await supabase.from("launch_rate_limits").insert({ ip_address: clientIP, token_id: null });
    } catch {
      // Ignore rate limit recording errors
    }

    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) {
      throw new Error("METEORA_API_URL not configured");
    }

    // Set job to processing
    await supabase.from("fun_token_jobs").update({ status: "processing" }).eq("id", jobId);

    // Start the long-running work in the background and respond immediately.
    waitUntil(
      runJobInBackground({
        jobId,
        meteoraApiUrl,
        name,
        ticker,
        description,
        storedImageUrl,
        websiteUrl,
        twitterUrl,
        creatorWallet,
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        status: "processing",
        message: "Token creation started. Polling for completion...",
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[fun-create] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
