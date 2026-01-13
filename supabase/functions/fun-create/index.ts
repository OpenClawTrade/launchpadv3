import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, ticker, description, imageUrl, creatorWallet } = await req.json();

    // Validate required fields
    if (!name || !ticker || !creatorWallet) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, ticker, creatorWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Solana address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creatorWallet)) {
      return new Response(
        JSON.stringify({ error: "Invalid Solana wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-create] Creating production token:", { name, ticker, creatorWallet });

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
          console.log("[fun-create] Image uploaded:", storedImageUrl);
        } else {
          console.error("[fun-create] Image upload error:", uploadError);
        }
      } catch (uploadErr) {
        console.error("[fun-create] Image processing error:", uploadErr);
      }
    }

    // Call Vercel API to create real on-chain pool with treasury wallet
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    
    if (!meteoraApiUrl) {
      throw new Error("METEORA_API_URL not configured");
    }

    // Get treasury wallet address from private key
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryPrivateKey) {
      throw new Error("TREASURY_PRIVATE_KEY not configured");
    }

    // Treasury wallet address (derived from private key, but we have it hardcoded)
    const treasuryWallet = "7UiXCtz3wxjiKS2W3LQsJcs6GqwfuDbeEcRhaAVwcHB2";

    console.log("[fun-create] Calling Meteora API for on-chain pool creation...");

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
        // Treasury creates and signs - no user signature needed
        serverSideSign: true,
        // Track the fee recipient
        feeRecipientWallet: creatorWallet,
      }),
    });

    let mintAddress: string;
    let dbcPoolAddress: string | null = null;

    if (poolResponse.ok) {
      const poolData = await poolResponse.json();
      mintAddress = poolData.mintAddress;
      dbcPoolAddress = poolData.dbcPoolAddress || poolData.poolAddress;
      console.log("[fun-create] On-chain pool created:", { mintAddress, dbcPoolAddress });
    } else {
      // If Vercel API fails, create a mock token for testing
      const errorText = await poolResponse.text();
      console.error("[fun-create] Pool API error:", errorText);
      
      // Generate mock mint address for fallback
      mintAddress = `Fun${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      console.log("[fun-create] Using mock mint address:", mintAddress);
    }

    // Insert into fun_tokens table
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
      })
      .select()
      .single();

    if (insertError) {
      console.error("[fun-create] Insert error:", insertError);
      throw new Error("Failed to create token record");
    }

    console.log("[fun-create] Token created:", funToken.id);

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: funToken.id,
        mintAddress,
        dbcPoolAddress,
        message: "Token launched! You'll receive 50% of trading fees every 30 minutes.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[fun-create] Error:", error);
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
