import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain", "Access-Control-Max-Age": "86400" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      name, ticker, description, imageUrl,
      phantomWallet, totalSupply, lpTokenAmount, lpSolAmount,
      // Phase 2 fields
      confirmed, mintAddress: confirmedMintAddress, poolAddress: confirmedPoolAddress,
    } = body;

    // ===== PHASE 2: Record token after on-chain confirmation =====
    if (confirmed === true && confirmedMintAddress && confirmedPoolAddress) {
      console.log("[fun-mode-create] 📝 Phase 2: Recording confirmed FUN mode token...");

      // Upload base64 image if needed
      let storedImageUrl = imageUrl;
      if (imageUrl?.startsWith("data:image")) {
        try {
          const base64Data = imageUrl.split(",")[1];
          const imageBuffer = Uint8Array.from(atob(base64Data), (c: string) => c.charCodeAt(0));
          const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}-fun.png`;
          const { error: uploadError } = await supabase.storage
            .from("post-images")
            .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);
            storedImageUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.error("[fun-mode-create] ⚠️ Image upload error:", uploadErr);
        }
      }

      const { data: funToken, error: insertError } = await supabase
        .from("fun_tokens")
        .insert({
          name: name?.slice(0, 50),
          ticker: ticker?.toUpperCase().slice(0, 10),
          description: description?.slice(0, 500) || null,
          image_url: storedImageUrl || null,
          creator_wallet: phantomWallet,
          mint_address: confirmedMintAddress,
          dbc_pool_address: confirmedPoolAddress,
          status: "active",
          price_sol: 0,
          launchpad_type: "fun_mode",
          fee_mode: "none",
          trading_fee_bps: 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[fun-mode-create] ❌ Insert error:", insertError);
        throw new Error("Failed to create FUN mode token record");
      }

      console.log("[fun-mode-create] ✅ FUN mode token recorded:", { id: funToken.id, name: funToken.name });

      return new Response(
        JSON.stringify({ success: true, tokenId: funToken.id, recorded: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== PHASE 1: Proxy to Vercel API =====
    if (!name || !ticker || !phantomWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, phantomWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin")?.replace(/\/$/, "") || "";
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL") || origin;

    if (!meteoraApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "API URL not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-mode-create] 📡 Calling create-fun-mode API:", `${meteoraApiUrl}/api/pool/create-fun-mode`);

    // Upload base64 image before forwarding
    let storedImageUrl = imageUrl;
    if (imageUrl?.startsWith("data:image")) {
      try {
        const base64Data = imageUrl.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), (c: string) => c.charCodeAt(0));
        const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}-fun.png`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);
          storedImageUrl = publicUrl;
        }
      } catch (uploadErr) {
        console.error("[fun-mode-create] ⚠️ Image upload error:", uploadErr);
      }
    }

    const poolResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description?.slice(0, 500) || `${name} - FUN mode token`,
        imageUrl: storedImageUrl,
        phantomWallet,
        totalSupply: totalSupply || 1_000_000_000,
        lpTokenAmount: lpTokenAmount || 10_000_000,
        lpSolAmount: lpSolAmount || 0.5,
      }),
    });

    if (!poolResponse.ok) {
      const errorText = await poolResponse.text();
      console.error("[fun-mode-create] ❌ API error:", poolResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Pool creation failed: ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const poolData = await poolResponse.json();

    if (!poolData.success || !poolData.mintAddress) {
      return new Response(
        JSON.stringify({ success: false, error: poolData.error || "Invalid pool creation response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-mode-create] ✅ Transactions prepared:", {
      mintAddress: poolData.mintAddress,
      poolAddress: poolData.poolAddress,
      txCount: poolData.unsignedTransactions?.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...poolData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fun-mode-create] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
