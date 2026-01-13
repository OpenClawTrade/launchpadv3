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
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, creatorWallet" }),
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

    console.log("[fun-create] 🚀 Creating token:", { name, ticker, creatorWallet });

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
    
    let mintAddress: string;
    let dbcPoolAddress: string | null = null;
    let onChainSuccess = false;

    if (meteoraApiUrl) {
      // Get treasury wallet address from private key
      const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
      if (!treasuryPrivateKey) {
        console.warn("[fun-create] ⚠️ TREASURY_PRIVATE_KEY not configured");
      }

      console.log("[fun-create] 📡 Calling Meteora API:", `${meteoraApiUrl}/api/pool/create-fun`);

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
            serverSideSign: true,
            feeRecipientWallet: creatorWallet,
          }),
        });

        if (poolResponse.ok) {
          const poolData = await poolResponse.json();
          mintAddress = poolData.mintAddress;
          dbcPoolAddress = poolData.dbcPoolAddress || poolData.poolAddress;
          onChainSuccess = true;
          console.log("[fun-create] ✅ On-chain pool created:", { mintAddress, dbcPoolAddress });
        } else {
          const errorText = await poolResponse.text();
          console.error("[fun-create] ❌ Pool API error:", poolResponse.status, errorText);
          // Generate placeholder mint address
          mintAddress = `Fun${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
          console.log("[fun-create] ⚠️ Using placeholder mint:", mintAddress);
        }
      } catch (fetchError) {
        console.error("[fun-create] ❌ Pool API fetch error:", fetchError);
        mintAddress = `Fun${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      }
    } else {
      console.warn("[fun-create] ⚠️ METEORA_API_URL not configured");
      mintAddress = `Fun${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
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
        status: onChainSuccess ? "active" : "pending",
        price_sol: 0.00000003,
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
      onChainSuccess,
      status: funToken.status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: funToken.id,
        name: funToken.name,
        ticker: funToken.ticker,
        mintAddress,
        dbcPoolAddress,
        imageUrl: storedImageUrl,
        onChainSuccess,
        solscanUrl: onChainSuccess ? `https://solscan.io/token/${mintAddress}` : null,
        tradeUrl: onChainSuccess ? `https://axiom.trade/meme/${mintAddress}` : null,
        message: onChainSuccess 
          ? "🚀 Token launched successfully! You'll receive 50% of trading fees every 30 minutes."
          : "⚠️ Token created but on-chain pool pending. The on-chain integration may need configuration.",
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
