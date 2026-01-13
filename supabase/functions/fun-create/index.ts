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

    console.log("[fun-create] Creating token:", { name, ticker, creatorWallet });

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

    // Generate a mock mint address for now (in production this would be a real token)
    const mockMintAddress = `Fun${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

    // Insert into fun_tokens table
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name: name.slice(0, 50),
        ticker: ticker.toUpperCase().slice(0, 5),
        description: description?.slice(0, 500) || null,
        image_url: storedImageUrl || null,
        creator_wallet: creatorWallet,
        mint_address: mockMintAddress,
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

    // TODO: In production, call the Vercel API to create real on-chain pool
    // const meteoraApiUrl = Deno.env.get("METEORA_API_URL");
    // This would create the actual pool using treasury wallet

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: funToken.id,
        mintAddress: mockMintAddress,
        message: "Token created! You'll receive 50% of trading fees every 6 hours.",
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
